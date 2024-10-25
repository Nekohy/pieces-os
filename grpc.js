const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// 加载proto文件
const packageDefinition = protoLoader.loadSync('./AI.proto', {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
});

// 获取gRPC对象
const aiProto = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.vertex; // 替换为proto文件中的包名

// 使用系统的根证书
const credentials = grpc.credentials.createSsl();

// 连接到gRPC服务器
const serverAddress = 'runtime-native-io-vertex-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';

function run(models, message, rules) {
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

        // 调用服务并获取响应
        client.Predict(request, (err, response) => {
                if (err) {
                        console.error('Error occurred during gRPC call:', err);
                        return;
                }
                console.log('Received response from server');
                console.log('Response Code:', response.responseCode);
                console.log('Processed Response:', response.args.args.args.response);
        });
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
                        run(models, message, rules || '');
                });
        });
});
