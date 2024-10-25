const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

class Config {
        constructor() {
                this.API_PREFIX = process.env.API_PREFIX || '/';
                this.API_KEY = process.env.API_KEY || '';
                this.MAX_RETRY_COUNT = process.env.MAX_RETRY_COUNT || 3;
                this.RETRY_DELAY = process.env.RETRY_DELAY || 5000;
        }
}

const config = new Config();

async function GrpcToPieces(models, message, rules) {
        // 加载proto文件
        const packageDefinition = protoLoader.loadSync('./AI.proto', {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
        });
        // 获取gRPC对象
        // noinspection JSUnresolvedReference
        const aiProto = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.vertex;

        // 使用系统的根证书
        const credentials = grpc.credentials.createSsl();

        // 连接到gRPC服务器
        const serverAddress = 'runtime-native-io-vertex-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
        const client = new aiProto.VertexInferenceService(serverAddress, credentials);

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

        for (retryCount = 0; retryCount <= config.MAX_RETRY_COUNT; retryCount++) {

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
                        let processed_response = response.args.args.args.response;
                        // 检查解构结果
                        if (!response_code || !processed_response) {
                                console.error('Invalid response format, retrying...');
                                continue; // 继续重试
                        }
                        console.log('Received response from server', response);

                        // 如果响应成功，返回结果
                        if (+response_code === 200) {
                                return { response_code, processed_response };
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

        return { rules, content };
}

async function ConvertOpenai(messages,response_code,stream) {
        if (response_code !== 200) {
                //todo 不知道返回什么
        }
        if (stream){
                // todo
        } else {
                return ChatCompletionWithModel(messages, response_code);
        }
}

function ChatCompletionWithModel(message, model) {
        return {
                id: 'Chat-Nekohy',
                object: 'chat.completion',
                created: 0,
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
                const { model: inputModel, messages, stream:todo} = await request.json();
                let stream = false;
                // 解析system和user/assistant消息
                const { rules, content } = messagesProcess(messages);
                const { response_code, processed_response } = GrpcToPieces(inputModel, content, rules, stream);
                return messagesProcess()
        } catch (err) {
                error(500, err.message);
        }
}

// 获取用户输入
const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
});

readline.question('Enter model: ', models => {
        readline.question('Enter message: ', message => {
                readline.question('Enter rules (可为空): ', rules => {
                        readline.close();
                        GrpcToPieces(models, message, rules || '');
                });
        });
});
