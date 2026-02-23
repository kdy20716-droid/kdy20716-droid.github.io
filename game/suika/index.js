// .env 파일의 내용을 불러옵니다
require("dotenv").config();

// 변수에 저장된 키를 가져옵니다
const apiKey = process.env.API_KEY;

console.log("API 키가 성공적으로 로드되었습니다:", apiKey);
