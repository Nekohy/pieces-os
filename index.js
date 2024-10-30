import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { AutoRouter, json, error, cors } from 'itty-router';
import dotenv from 'dotenv';
import { createServerAdapter } from '@whatwg-node/server';
import { createServer } from 'http';

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
                this.COMMON_PROTO = './VertexInferenceService.proto';
                this.GPT_GRPC = 'runtime-native-io-gpt-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
                this.GPT_PROTO = './GPTInferenceService.proto';
                this.PORT = process.env.PORT || 8787;
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

async function GrpcToPieces(models, message, rules,stream,temperature,top_p) {
        // 在非GPT类型的模型中，temperature和top_p是无效的
        // 使用系统的根证书
        const credentials = grpc.credentials.createSsl();
        if (models.includes('gpt')){
                // 加载proto文件
                const packageDefinition = protoLoader.loadSync(config.GPT_PROTO, {
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true
                });
                // 构建请求消息
                const request = {
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
                const client = new GRPCobjects.GPTInferenceService(config.GPT_GRPC, credentials);
                for (let retryCount = 0; retryCount <= config.MAX_RETRY_COUNT; retryCount++) {
                        try {
                                // 使用 Promise 包装异步 gRPC 调用
                                const response = await new Promise((resolve, reject) => {
                                        client.Predict(request, (err, response) => {
                                                if (err) {
                                                        reject(err);
                                                } else {
                                                        resolve(response);
                                                }
                                        });
                                });
                                // 处理响应
                                let response_code = response.response_code;
                                let response_message = response.body.message_warpper.message;
                                // 检查解构结果
                                if (!response_code || !response_message) {
                                        console.error('Invalid response format, retrying...');
                                        continue; // 继续重试
                                }
                                console.log('Received response from server', response);

                                // 如果响应成功，返回结果
                                if (+response_code === 200) {
                                        return { response_code, response_message };
                                } else {
                                        // 如果响应码不是200，继续重试
                                        console.error('Non-success response code, retrying...');
                                }
                        } catch (err) {
                                // 捕获错误并重试
                                console.error('Error occurred during gRPC call:', err);
                        }
                }
        } else {
                // 加载proto文件
                const packageDefinition = protoLoader.loadSync(config.COMMON_PROTO,{
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true
                });
                // 构建请求消息
                const request = {
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
                const client = new GRPCobjects.VertexInferenceService(config.COMMON_GRPC, credentials);
                for (let retryCount = 0; retryCount <= config.MAX_RETRY_COUNT; retryCount++) {
                        try {
                                // 使用 Promise 包装异步 gRPC 调用
                                const response = await new Promise((resolve, reject) => {
                                        client.Predict(request, (err, response) => {
                                                if (err) {
                                                        reject(err);
                                                } else {
                                                        resolve(response);
                                                }
                                        });
                                });

                                // 处理响应
                                let response_code = response.response_code;
                                let response_message = response.args.args.args.message;
                                // 检查解构结果
                                if (!response_code || !response_message) {
                                        console.error('Invalid response format, retrying...');
                                        continue; // 继续重试
                                }
                                console.log('Received response from server', response);

                                // 如果响应成功，返回结果
                                if (+response_code === 200) {
                                        return { response_code, response_message };
                                } else {
                                        // 如果响应码不是200，继续重试
                                        console.error('Non-success response code, retrying...');
                                }
                        } catch (err) {
                                // 捕获错误并重试
                                console.error('Error occurred during gRPC call:', err);
                        }
                }
        }
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

async function ConvertOpenai(messages,response_code,stream) {
        if (response_code !== 200) {
                //todo 不知道返回什么
        }
        if (stream){
                // todo
        } else {
                return new Response(JSON.stringify(ChatCompletionWithModel(messages, response_code)), {
                        headers: {
                                'Content-Type': 'application/json',
                        },
                });
        }
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

async function handleCompletion(request) {
        try {
                // todo stream逆向接口
                // 解析openai格式API请求
                const { model: inputModel, messages, stream:todo,temperature,top_p} = await request.json();
                console.log(inputModel,messages,todo)
                let stream = false;
                // 解析system和user/assistant消息
                const { rules, message:content } = await messagesProcess(messages);
                console.log(rules,content)
                // 响应码，回复的消息
                const { response_code, response_message } = await GrpcToPieces(inputModel, content, rules, stream, temperature, top_p);
                // 转换为OpenAi格式
                return await ConvertOpenai(response_message,response_code,stream)
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