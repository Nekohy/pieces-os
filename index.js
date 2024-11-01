import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import {AutoRouter, cors, error, json} from 'itty-router';
import dotenv from 'dotenv';
import {createServerAdapter} from '@whatwg-node/server';
import {createServer} from 'http';

// 加载环境变量
dotenv.config();
// 初始化配置
class Config {
        constructor() {
                this.API_PREFIX = process.env.API_PREFIX || '/';
                this.API_KEY = process.env.API_KEY || '';
                this.MAX_RETRY_COUNT = process.env.MAX_RETRY_COUNT || 3;
                this.RETRY_DELAY = process.env.RETRY_DELAY || 5000;
                this.COMMON_GRPC = 'runtime-native-io-vertex-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
                this.COMMON_PROTO = './protos/VertexInferenceService.proto';
                this.GPT_GRPC = 'runtime-native-io-gpt-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
                this.GPT_PROTO = './protos/GPTInferenceService.proto';
                this.PORT = process.env.PORT || 8787;
        }
}
class GRPCHandler {
        constructor(protoFilePath) {
                // 动态加载传入的 .proto 文件路径
                this.packageDefinition = protoLoader.loadSync(protoFilePath, {
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true
                });
        }
}
const config = new Config();
// 中间件
// 添加运行回源
const { preflight, corsify } = cors({
	origin: '*',
	allowMethods: '*',
	exposeHeaders: '*',
});

// 添加认证
const withAuth = (request) => {
	if (config.API_KEY) {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return error(401, 'Unauthorized: Missing or invalid Authorization header');
		}
		const token = authHeader.substring(7);
		if (token !== config.API_KEY) {
			return error(403, 'Forbidden: Invalid API key');
		}
	}
};
// 返回运行信息
const logger = (res, req) => {
	console.log(req.method, res.status, req.url, Date.now() - req.start, 'ms');
};
const router = AutoRouter({
	before: [preflight, withAuth],
	missing: () => error(404, '404 not found.'),
	finally: [corsify, logger],
});
// Router路径
router.get('/', () => json({ message: 'API 服务运行中~' }));
router.get('/ping', () => json({ message: 'pong' }));
router.post(config.API_PREFIX + '/v1/chat/completions', (req) => handleCompletion(req));

async function GrpcToPieces(models, message, rules, stream, temperature, top_p) {
        // 在非GPT类型的模型中，temperature和top_p是无效的
        // 使用系统的根证书
        const credentials = grpc.credentials.createSsl();
        let client,request;
        if (models.includes('gpt')){
                // 加载proto文件
                const packageDefinition = new GRPCHandler(config.GPT_PROTO).packageDefinition;
                // 构建请求消息
                request = {
                        models: models,
                        messages: [
                                {role: 0, message: rules}, // system
                                {role: 1, message: message} // user
                        ],
                        temperature:temperature || 0.1,
                        top_p:top_p ?? 1,
                }
                // 获取gRPC对象
                const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.gpt;
                client = new GRPCobjects.GPTInferenceService(config.GPT_GRPC, credentials);
        } else {
                // 加载proto文件
                const packageDefinition = new GRPCHandler(config.COMMON_PROTO).packageDefinition;
                // 构建请求消息
                request = {
                        models: models,
                        args: {
                                messages: {
                                        unknown: 1,
                                        message: message
                                },
                                rules: rules
                        }
                };
                // 获取gRPC对象
                const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.vertex;
                client = new GRPCobjects.VertexInferenceService(config.COMMON_GRPC, credentials);
        }
        return await ConvertOpenai(client,request,models,stream);
}

async function messagesProcess(messages) {
        let rules = '';
        let message = '';

        for (const msg of messages) {
                let role = msg.role;
                // 格式化为字符串
                const contentStr = Array.isArray(msg.content)
                    ? msg.content
                    .filter((item) => item.text)
                    .map((item) => item.text)
                    .join('') || ''
                    : msg.content;
                // 判断身份
                if (role === 'system') {
                        rules += `system:${contentStr};\r\n`;
                } else if (['user', 'assistant'].includes(role)) {
                        message += `${role}:${contentStr};\r\n`;
                }
        }

        return { rules, message };
}

async function ConvertOpenai(client,request,model,stream) {
        for (let i = 0; i < config.MAX_RETRY_COUNT; i++) {
                try {
                        if (stream) {
                                const call = client.PredictWithStream(request);
                                const encoder = new TextEncoder();
                                const ReturnStream = new ReadableStream({
                                    start(controller) {
                                            call.on('data', (response) => {
                                                    let response_code = Number(response.response_code);
                                                    if (response_code === 204) {
                                                            // 如果 response_code 是 204，关闭流
                                                            controller.close()
                                                            call.destroy()
                                                    } else if (response_code === 200) {
                                                            let response_message
                                                            if (model.includes('gpt')) {
                                                                    response_message = response.body.message_warpper.message.message;
                                                            } else {
                                                                    response_message = response.args.args.args.message;
                                                            }
                                                            // 否则，将数据块加入流中
                                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ChatCompletionStreamWithModel(response_message, model))}\n\n`));
                                                    } else {
                                                            controller.error(new Error(`Error: stream chunk is not success`));
                                                            controller.close()
                                                    }
                                            })
                                    }
                                    });
                                return new Response(ReturnStream, {
                                        headers: {
                                                'Content-Type': 'text/event-stream',
                                        },
                                })
                } else {
                        const call = await new Promise((resolve, reject) => {
                                client.Predict(request, (err, response) => {
                                        if (err) reject(err);
                                        else resolve(response);
                                });
                        });
                        let response_code = Number(call.response_code);
                        if (response_code === 200) {
                                let response_message
                                if (model.includes('gpt')) {
                                        response_message = call.body.message_warpper.message.message;
                                } else {
                                        response_message = call.args.args.args.message;
                                }
                                return new Response(JSON.stringify(ChatCompletionWithModel(response_message, model)), {
                                                headers: {
                                                        'Content-Type': 'application/json',
                                                },
                                        });
                                }
                        }
                } catch (err) {
                        console.error(err);
                        await new Promise((resolve) => setTimeout(resolve, config.RETRY_DELAY));
                }
        }
        return error(500, err.message);
}

function ChatCompletionWithModel(message, model) {
        return {
                id: 'Chat-Nekohy',
                object: 'chat.completion',
                created: Date.now(),
                model,
                usage: {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                },
                choices: [
                        {
                                message: {
                                        content: message,
                                        role: 'assistant',
                                },
                                index: 0,
                        },
                ],
        };
}

function ChatCompletionStreamWithModel(text, model) {
        return {
                id: 'chatcmpl-QXlha2FBbmROaXhpZUFyZUF3ZXNvbWUK',
                object: 'chat.completion.chunk',
                created: 0,
                model,
                choices: [
                        {
                                index: 0,
                                delta: {
                                        content: text,
                                },
                                finish_reason: null,
                        },
                ],
        };
}

async function handleCompletion(request) {
        try {
                // todo stream逆向接口
                // 解析openai格式API请求
                const { model: inputModel, messages, stream,temperature,top_p} = await request.json();
                console.log(inputModel,messages,stream)
                // 解析system和user/assistant消息
                const { rules, message:content } = await messagesProcess(messages);
                console.log(rules,content)
                // 响应码，回复的消息
                return await GrpcToPieces(inputModel, content, rules, stream, temperature, top_p);
        } catch (err) {
                return error(500, err.message);
        }
}

(async () => {
	//For Cloudflare Workers
	if (typeof addEventListener === 'function') return;
	// For Nodejs
	const ittyServer = createServerAdapter(router.fetch);
	console.log(`Listening on http://localhost:${config.PORT}`);
	const httpServer = createServer(ittyServer);
	httpServer.listen(config.PORT);
})();