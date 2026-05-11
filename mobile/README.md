# Stan Mobile App

React Native (Expo) 기반 웹뷰 앱입니다. 기존 웹 앱을 모바일 앱으로 감싸서 제공합니다.

## 설정

### 1. 환경 변수 설정

프로덕션 웹 앱 URL을 설정해야 합니다. 두 가지 방법이 있습니다:

#### 방법 1: app.json의 extra.webUrl 수정
`app.json` 파일의 `expo.extra.webUrl` 값을 실제 프로덕션 URL로 변경하세요.

```json
{
  "expo": {
    "extra": {
      "webUrl": "https://your-actual-vercel-url.vercel.app"
    }
  }
}
```

#### 방법 2: 환경 변수 사용 (권장)
`.env` 파일을 생성하고 다음을 추가하세요:

```
EXPO_PUBLIC_WEB_URL=https://your-actual-vercel-url.vercel.app
```

### 2. Android 개발 환경 설정

#### 필수 요구사항
- Node.js (v18 이상)
- Android Studio
- Android SDK (API 33 이상)
- Java Development Kit (JDK 17)

#### Android Studio 설정
1. Android Studio 설치
2. Android SDK 설치 (Tools > SDK Manager)
3. Android Virtual Device (AVD) 생성 (Tools > Device Manager)

## 실행

### 개발 서버 시작
```bash
cd mobile
npm start
```

### Android 에뮬레이터에서 실행
```bash
npm run android
```

### 실제 Android 기기에서 실행
1. USB 디버깅 활성화 (개발자 옵션)
2. 기기 연결
3. `npm run android` 실행

## 빌드

### Android APK 빌드
```bash
npx expo build:android
```

### Android App Bundle (AAB) 빌드 (Play Store용)
```bash
npx expo build:android -t app-bundle
```

## 주요 기능

- 웹뷰를 통한 웹 앱 로드
- 로딩 상태 표시
- 에러 처리 및 재시도 기능
- 쿠키/세션 유지
- 위치 권한 지원 (Android)

## 문제 해결

### 웹뷰가 로드되지 않는 경우
1. `app.json`의 `extra.webUrl` 또는 환경 변수 `EXPO_PUBLIC_WEB_URL`이 올바르게 설정되었는지 확인
2. 인터넷 연결 확인
3. 웹 앱 URL이 정상적으로 접근 가능한지 브라우저에서 확인

### Android 빌드 오류
1. Android Studio에서 SDK가 올바르게 설치되었는지 확인
2. `android/build.gradle` 파일 확인
3. `npx expo prebuild` 실행 후 다시 빌드 시도

## 향후 개선 사항

- 네이티브 푸시 알림 (FCM)
- 딥링크 처리
- 네이티브 카메라/갤러리 접근
- 네이티브 공유 기능
- iOS 지원 확장
