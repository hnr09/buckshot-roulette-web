# Buckshot Roulette Web

브라우저에서 즐기는 2인 실시간 Buckshot Roulette 프로토타입입니다. Express와 Socket.IO를 사용합니다.

## 실행

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 열어 방을 만들고, 다른 브라우저/기기에서 방 코드로 참가하세요.

## 배포

Node.js를 지원하는 호스팅에 GitHub 저장소를 연결하고 시작 명령을 `npm start`로 설정합니다. 호스팅 플랫폼이 제공하는 `PORT` 환경변수를 서버가 자동으로 사용합니다.

## 참고

현재 게임 상태와 대기실은 서버 메모리에 저장됩니다. 서버가 재시작되면 방과 게임은 초기화됩니다.