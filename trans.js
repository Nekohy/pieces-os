function messagesPrepare(messages) {
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

const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' },
    { role: 'assistant', content: 'The capital of France is Paris.' }
];

const result = messagesPrepare(messages);
console.log(result.rules);  // 输出: system:You are a helpful assistant.;
console.log(result.message);  // 输出: user:What is the capital of France;;assistant:The capital of France is Paris;;

