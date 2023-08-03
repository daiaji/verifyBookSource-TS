// 假设你的JSON字符串如下：
let jsonString = "\"searchUrl\":\"s.php,{\\n  \\\"method\\\": \\\"POST\\\",\\n  \\\"charset\\\": \\\"gbk\\\",\\n  \\\"body\\\": \\\"s={{key}}&type=articlename\\\"\\n}\\n\"";

// 你需要将它转换为一个有效的JavaScript对象字面量：
let validJsCode = '{' + jsonString + '}';

// 然后你可以使用eval方法来获取这个键值的JSON部分：
let jsonObject;
try {
    jsonObject = eval('(' + validJsCode + ')');
} catch (e) {
    console.error('Eval failed:', e);
}

// 现在jsonObject应该包含你的JSON数据
console.log(jsonObject);
