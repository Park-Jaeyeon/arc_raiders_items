# ARC Raiders Inventory Manager

ARC Raiders 게임의 인벤토리를 관리하고, 스크린샷을 통해 아이템을 자동으로 인식하는 웹 애플리케이션입니다.

## 주요 기능

*   **아이템 데이터베이스**: 게임 내 아이템 정보를 조회하고 관리합니다.
*   **AI 비전 인식 (Image Recognition)**: 인벤토리 스크린샷을 업로드하면 CLIP 모델을 사용하여 아이템을 자동으로 식별합니다.
*   **OCR (광학 문자 인식)**: 텍스트 인식을 통해 수량 등을 파악합니다.

## 시작하기

이 프로젝트를 실행하기 위해서는 Node.js 환경이 필요합니다.

### 설치 및 설정 단계

프로젝트를 처음 시작할 때 다음 단계들을 순서대로 실행해주세요.

1.  **패키지 설치**
    ```bash
    npm install
    ```

2.  **AI 모델 다운로드**
    이미지 분석에 사용되는 `Xenova/clip-vit-base-patch32` 모델을 로컬로 다운로드합니다.
    ```bash
    npm run download-model
    ```

3.  **게임 데이터 및 아이콘 동기화**
    외부 위키 및 데이터베이스에서 최신 아이템 정보와 아이콘 이미지를 가져옵니다.
    ```bash
    npm run fetch:gamedata
    ```

4.  **AI 임베딩 데이터 생성**
    다운로드한 아이콘 이미지들을 분석하여 AI가 인식할 수 있는 벡터 데이터(`embeddings.json`)를 생성합니다.
    *이 단계가 선행되어야 이미지 인식이 작동합니다.*
    ```bash
    npm run embed:generate
    ```

### 개발 서버 실행

설정이 완료되면 다음 명령어로 개발 서버를 실행하세요.

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` (또는 터미널에 표시된 주소)으로 접속하여 애플리케이션을 사용할 수 있습니다.

## 트러블슈팅

*   **페이지 접속 시 "Worker Init Error" 또는 모델 관련 에러가 발생하는 경우:**
    `npm run download-model` 명령어를 실행하여 모델 파일이 `public/models` 폴더에 제대로 다운로드되었는지 확인해주세요.

*   **아이템 인식이 전혀 되지 않는 경우:**
    `npm run embed:generate` 명령어를 실행하여 `public/embeddings.json` 파일이 생성되었는지 확인해주세요.

*   **아이콘 이미지가 보이지 않는 경우:**
    `npm run fetch:gamedata` 명령어를 통해 아이콘을 다운로드해주세요.

## 기술 스택

*   React + TypeScript
*   Vite
*   Transformers.js (AI Vision)
*   Tesseract.js (OCR)
*   Tailwind CSS