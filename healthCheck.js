import http from 'http';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const PORT_TO_CHECK = 8787;
const CHECK_INTERVAL = (process.env.CHECK_INTERVAL || 60) * 1000; // 默认60秒，转换为毫秒

function checkPort() {
  console.log(`[${new Date().toISOString()}] 正在检查端口 ${PORT_TO_CHECK}...`);
  
  http.get(`http://localhost:${PORT_TO_CHECK}`, (res) => {
    if (res.statusCode === 200 || res.statusCode === 401) {
      console.log(`[${new Date().toISOString()}] 端口 ${PORT_TO_CHECK} 响应正常。`);
    } else {
      console.log(`[${new Date().toISOString()}] 端口 ${PORT_TO_CHECK} 响应异常，状态码: ${res.statusCode}`);
      restartApp();
    }
  }).on('error', (err) => {
    console.error(`[${new Date().toISOString()}] 检查端口 ${PORT_TO_CHECK} 时发生错误:`, err.message);
    restartApp();
  });
}

function restartApp() {
  console.log(`[${new Date().toISOString()}] 正在重启应用...`);
  
  exec('node api/index.js', () => {
    console.log(`[${new Date().toISOString()}] 已尝试重启，继续执行健康检查...`);
  });
}

function startChecking() {
  setInterval(checkPort, CHECK_INTERVAL);
}

// 启动时开始检查
startChecking();
