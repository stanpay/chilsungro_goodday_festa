import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 환경 변수에서 웹 URL 가져오기 (없으면 기본값 사용)
const getWebUrl = () => {
  const configUrl = Constants.expoConfig?.extra?.webUrl || process.env.EXPO_PUBLIC_WEB_URL;
  
  if (configUrl) {
    // Android 에뮬레이터에서 호스트 접근을 위해 IP 변환
    if (Platform.OS === 'android' && configUrl.includes('172.30.1.')) {
      // Android 에뮬레이터는 10.0.2.2를 통해 호스트에 접근
      return configUrl.replace(/172\.30\.1\.\d+/, '10.0.2.2');
    }
    return configUrl;
  }
  
  return 'https://your-vercel-url.vercel.app';
};

const WEB_URL = getWebUrl();

// 모바일 User-Agent 설정 (카카오 OAuth가 모바일 환경으로 인식하도록)
const getMobileUserAgent = () => {
  if (Platform.OS === 'ios') {
    // iOS Safari User-Agent
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  } else {
    // Android Chrome User-Agent
    return 'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  }
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasBackButton, setHasBackButton] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadProgressRef = useRef<number>(0);
  const loadEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // 하드웨어 뒤로가기 버튼 처리
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // WebView에서 뒤로가기 가능한 경우
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true; // 이벤트 소비
      }
      
      // 웹 앱에 뒤로가기 버튼이 있는 경우
      if (hasBackButton) {
        // 웹 앱의 뒤로가기 버튼 클릭 시뮬레이션
        webViewRef.current?.injectJavaScript(`
          (function() {
            // header 내의 뒤로가기 버튼 우선 찾기
            const headers = document.querySelectorAll('header');
            for (let header of headers) {
              const buttons = header.querySelectorAll('button, a');
              for (let btn of buttons) {
                const svg = btn.querySelector('svg');
                if (svg) {
                  const paths = svg.querySelectorAll('path');
                  for (let path of paths) {
                    const d = path.getAttribute('d') || '';
                    if (d.includes('M19 12H5') || 
                        d.includes('M15 18l-6-6') || 
                        d.includes('M15 19l-7-7') ||
                        d.includes('M11 17l-6-6') ||
                        d.includes('M9 18l6-6')) {
                      btn.click();
                      return;
                    }
                  }
                }
                
                // 클래스명으로 확인
                const className = btn.className || '';
                if (className.includes('ArrowLeft') || 
                    className.includes('ChevronLeft') ||
                    className.includes('arrow-left') ||
                    className.includes('back')) {
                  btn.click();
                  return;
                }
                
                // href로 확인
                const href = btn.getAttribute('href');
                if (href && (href.startsWith('/main') || 
                            href.startsWith('/mypage') || 
                            (href.startsWith('/') && href !== window.location.pathname))) {
                  btn.click();
                  return;
                }
              }
            }
            
            // header 외부의 뒤로가기 버튼 확인 (예: Payment step 2)
            const navButtons = document.querySelectorAll('button[onclick*="navigate"], button[onclick*="history"]');
            for (let btn of navButtons) {
              const onClick = btn.getAttribute('onclick') || '';
              if (onClick.includes('navigate(-1)') || 
                  onClick.includes('history.back()') ||
                  onClick.includes('navigate') && onClick.includes('Step')) {
                btn.click();
                return;
              }
            }
          })();
          true;
        `);
        return true; // 이벤트 소비
      }
      
      // 뒤로가기 불가능한 경우 앱 종료 확인
      Alert.alert(
        '앱 종료',
        '앱을 종료하시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '종료',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ],
        { cancelable: false }
      );
      return true; // 이벤트 소비
    });

    return () => backHandler.remove();
  }, [canGoBack, hasBackButton]);
  
  // 로딩 타임아웃 처리 (30초)
  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        if (loading) {
          setError('페이지 로딩 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
          setLoading(false);
        }
      }, 30000);
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (loadEndTimeoutRef.current) {
        clearTimeout(loadEndTimeoutRef.current);
      }
    };
  }, [loading]);

  const handleLoadStart = () => {
    // 초기 로드가 아닌 경우에만 로딩 상태를 true로 설정
    // (페이지 내 네비게이션으로 인한 반복 로딩 방지)
    if (isInitialLoadRef.current) {
      setLoading(true);
      setError(null);
      loadProgressRef.current = 0;
    }
  };

  const handleLoadEnd = () => {
    // 로딩 완료 처리 (약간의 지연을 두어 안정성 확보)
    if (loadEndTimeoutRef.current) {
      clearTimeout(loadEndTimeoutRef.current);
    }
    
    loadEndTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      isInitialLoadRef.current = false;
      loadProgressRef.current = 1;
    }, 300);
  };

  const handleLoadProgress = (event: any) => {
    const progress = event.nativeEvent.progress;
    loadProgressRef.current = progress;
    
    // 진행률이 90% 이상이면 로딩 완료로 처리
    // (onLoadEnd가 호출되지 않는 경우 대비)
    if (progress >= 0.9 && loading) {
      if (loadEndTimeoutRef.current) {
        clearTimeout(loadEndTimeoutRef.current);
      }
      
      loadEndTimeoutRef.current = setTimeout(() => {
        setLoading(false);
        isInitialLoadRef.current = false;
      }, 500);
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError('페이지를 불러오는 중 오류가 발생했습니다.');
    setLoading(false);
  };

  const handleHttpError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    if (nativeEvent.statusCode >= 400) {
      setError(`서버 오류가 발생했습니다. (${nativeEvent.statusCode})`);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    
    // 페이지가 완전히 로드되었는지 확인
    if (navState.loading === false && loading) {
      // 네비게이션 상태에서 로딩이 완료되었지만 로딩 상태가 true인 경우
      setTimeout(() => {
        setLoading(false);
        isInitialLoadRef.current = false;
      }, 500);
    }
  };

  const handleReload = () => {
    setError(null);
    isInitialLoadRef.current = true;
    loadProgressRef.current = 0;
    webViewRef.current?.reload();
  };

  // 네비게이션 요청 제어 (불필요한 리로드 방지)
  const shouldStartLoadWithRequest = (request: any) => {
    const { url } = request;
    const currentUrl = WEB_URL;
    
    // 같은 URL로의 반복 리로드는 허용하지 않음 (무한 리로드 방지)
    // 단, 초기 로드나 쿼리 파라미터가 있는 경우는 허용
    if (url === currentUrl && !isInitialLoadRef.current) {
      // URL에 쿼리 파라미터나 해시가 있으면 허용 (예: OAuth 콜백)
      if (url.includes('?') || url.includes('#')) {
        return true;
      }
      return false;
    }
    
    // 모든 다른 요청은 허용 (OAuth 리다이렉트 등)
    return true;
  };

  // 위치 정보 가져오기 함수
  const getCurrentLocation = async () => {
    try {
      // 위치 권한 확인
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: '위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.'
        };
      }

      // 현재 위치 가져오기
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      return {
        success: true,
        coords: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'POSITION_UNAVAILABLE',
        message: error.message || '위치 정보를 가져올 수 없습니다.'
      };
    }
  };

  // WebView에서 메시지 수신 처리
  const handleMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'WEB_CONSOLE') {
        // no-op
      } else if (message.type === 'REQUEST_LOCATION') {
        const locationResult = await getCurrentLocation();
        
        // 결과를 WebView로 전송
        const response = JSON.stringify({
          type: 'LOCATION_RESPONSE',
          ...locationResult
        });
        
        webViewRef.current?.postMessage(response);
      } else if (message.type === 'PAGE_LOADED') {
        // 페이지 로드 완료 메시지 수신 시 로딩 상태 해제
        if (loadEndTimeoutRef.current) {
          clearTimeout(loadEndTimeoutRef.current);
        }
        setTimeout(() => {
          setLoading(false);
          isInitialLoadRef.current = false;
        }, 200);
      } else if (message.type === 'HAS_BACK_BUTTON') {
        // 웹 앱에서 뒤로가기 버튼 존재 여부 수신
        setHasBackButton(message.hasBackButton || false);
      } else if (message.type === 'LOAD_STORAGE_DATA') {
        // AsyncStorage에서 모든 위치 관련 데이터 로드하여 WebView에 전송
        const loadStorageData = async () => {
          try {
            const keys = [
              'lastLocationFetchTime',
              'currentCoordinates',
              'selectedLocation',
              'isManualLocation',
              'nearbyStores',
              'nearbyStoresFull',
            ];
            const data: Record<string, string | null> = {};

            for (const key of keys) {
              const value = await AsyncStorage.getItem(key);
              data[key] = value;
            }

            // WebView에 데이터 전송
            const response = JSON.stringify({
              type: 'STORAGE_DATA_LOADED',
              data: data
            });

            webViewRef.current?.injectJavaScript(`
              (function() {
                if (window.receiveStorageData) {
                  window.receiveStorageData(${JSON.stringify(data)});
                }
              })();
            `);
          } catch (error) {
          }
        };
        loadStorageData();
      } else if (message.type === 'SAVE_STORAGE_DATA') {
        // AsyncStorage에 데이터 저장
        const saveStorageData = async () => {
          try {
            if (message.value === null || message.value === undefined) {
              await AsyncStorage.removeItem(message.key);
            } else {
              await AsyncStorage.setItem(message.key, String(message.value));
            }
          } catch (error) {
          }
        };
        saveStorageData();
      } else if (message.type === 'GET_STORAGE_DATA') {
        // AsyncStorage에서 특정 키의 데이터 조회하여 WebView에 전송
        const getStorageData = async () => {
          try {
            const value = await AsyncStorage.getItem(message.key);

            webViewRef.current?.injectJavaScript(`
              (function() {
                if (window.receiveStorageValue) {
                  window.receiveStorageValue('${message.key}', ${JSON.stringify(value)});
                }
              })();
            `);
          } catch (error) {
          }
        };
        getStorageData();
      }
    } catch (error) {
    }
  };

  // 웹 앱에 React Native 환경임을 알리는 JavaScript 코드
  const injectedJavaScript = `
    (function() {
      // 네이티브 위치 서비스 사용 가능 여부 표시
      window.isReactNative = true;
      window.isMobile = true;

      // localStorage를 AsyncStorage로 브리징하여 안드로이드 웹뷰 재시작 시에도 유지
      (function() {
        const originalSetItem = Storage.prototype.setItem;
        const originalGetItem = Storage.prototype.getItem;
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalClear = Storage.prototype.clear;

        // AsyncStorage로 브리징할 키들 (위치 관련 데이터만)
        const bridgedKeys = [
          'lastLocationFetchTime',
          'currentCoordinates',
          'selectedLocation',
          'isManualLocation',
          'nearbyStores',
          'nearbyStoresFull',
        ];

        // AsyncStorage에서 데이터 로드
        function loadFromAsyncStorage() {
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LOAD_STORAGE_DATA'
            }));
          }
        }

        // AsyncStorage에 데이터 저장
        function saveToAsyncStorage(key, value) {
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SAVE_STORAGE_DATA',
              key: key,
              value: value
            }));
          }
        }

        // Storage.prototype.setItem 오버라이드
        Storage.prototype.setItem = function(key, value) {
          // 브리징할 키인 경우 AsyncStorage에도 저장
          if (bridgedKeys.includes(key)) {
            saveToAsyncStorage(key, value);
          }
          // 원래 localStorage 동작 유지
          return originalSetItem.call(this, key, value);
        };

        // Storage.prototype.getItem 오버라이드
        Storage.prototype.getItem = function(key) {
          // 브리징할 키인 경우 우선순위: localStorage > AsyncStorage
          if (bridgedKeys.includes(key)) {
            const localValue = originalGetItem.call(this, key);
            if (localValue !== null) {
              return localValue;
            }
            // localStorage에 없으면 AsyncStorage에서 로드 시도
            if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'GET_STORAGE_DATA',
                key: key
              }));
              // 동기적으로 반환할 수 없으므로 null 반환하고 비동기로 처리
              return null;
            }
          }
          return originalGetItem.call(this, key);
        };

        // Storage.prototype.removeItem 오버라이드
        Storage.prototype.removeItem = function(key) {
          if (bridgedKeys.includes(key)) {
            saveToAsyncStorage(key, null); // null로 설정하여 삭제 의미
          }
          return originalRemoveItem.call(this, key);
        };

        // Storage.prototype.clear 오버라이드 (브리징 키만 삭제)
        const originalClear = Storage.prototype.clear;
        Storage.prototype.clear = function() {
          bridgedKeys.forEach(key => {
            saveToAsyncStorage(key, null);
          });
          return originalClear.call(this);
        };

        // AsyncStorage에서 로드된 데이터를 localStorage에 설정하는 함수
        window.receiveStorageData = function(data) {
          Object.keys(data).forEach(key => {
            const value = data[key];
            if (value !== null && value !== undefined) {
              localStorage.setItem(key, String(value));
            }
          });
        };

        // AsyncStorage에서 조회된 개별 데이터를 localStorage에 설정하는 함수
        window.receiveStorageValue = function(key, value) {
          if (value !== null && value !== undefined) {
            localStorage.setItem(key, String(value));
          }
        };

        // 초기 로드 시 AsyncStorage에서 데이터 복원
        loadFromAsyncStorage();
      })();
      
      // User-Agent를 모바일로 설정 (카카오 OAuth 인식용)
      Object.defineProperty(navigator, 'userAgent', {
        get: function() {
          return '${getMobileUserAgent()}';
        },
        configurable: true
      });
      
      // 네이티브 위치 서비스 요청 함수
      window.requestNativeLocation = function() {
        return new Promise((resolve, reject) => {
          let timeoutId;
          let messageHandler;
          
          // 타임아웃 설정 (15초)
          timeoutId = setTimeout(() => {
            if (messageHandler) {
              window.removeEventListener('message', messageHandler);
              document.removeEventListener('message', messageHandler);
            }
            reject(new Error('위치 요청 시간이 초과되었습니다.'));
          }, 15000);
          
          // 메시지 리스너 등록 (두 가지 방식 모두 지원)
          messageHandler = (event) => {
            try {
              const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              
              if (data.type === 'LOCATION_RESPONSE') {
                clearTimeout(timeoutId);
                window.removeEventListener('message', messageHandler);
                document.removeEventListener('message', messageHandler);
                
                if (data.success) {
                  resolve({
                    coords: {
                      latitude: data.coords.latitude,
                      longitude: data.coords.longitude,
                      accuracy: data.coords.accuracy
                    }
                  });
                } else {
                  const error = new Error(data.message || '위치 정보를 가져올 수 없습니다.');
                  error.code = data.error === 'PERMISSION_DENIED' ? 1 : data.error === 'POSITION_UNAVAILABLE' ? 2 : 3;
                  error.PERMISSION_DENIED = 1;
                  error.POSITION_UNAVAILABLE = 2;
                  error.TIMEOUT = 3;
                  reject(error);
                }
              }
            } catch (err) {
              clearTimeout(timeoutId);
              window.removeEventListener('message', messageHandler);
              document.removeEventListener('message', messageHandler);
              reject(err);
            }
          };
          
          // 두 가지 이벤트 리스너 모두 등록 (플랫폼별 차이 대응)
          window.addEventListener('message', messageHandler);
          document.addEventListener('message', messageHandler);
          
          // React Native로 위치 요청 메시지 전송
          // React Native WebView는 window.ReactNativeWebView.postMessage를 제공합니다
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'REQUEST_LOCATION'
            }));
          } else {
            // WebView가 준비되지 않은 경우
            clearTimeout(timeoutId);
            window.removeEventListener('message', messageHandler);
            document.removeEventListener('message', messageHandler);
            reject(new Error('React Native WebView가 준비되지 않았습니다.'));
          }
        });
      };
      
      // 기존 navigator.geolocation을 네이티브 버전으로 래핑
      if (window.isReactNative && window.requestNativeLocation) {
        const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          window.requestNativeLocation()
            .then((position) => {
              if (success) {
                success(position);
              }
            })
            .catch((err) => {
              if (error) {
                const geolocationError = {
                  code: err.code || (err.message && err.message.includes('PERMISSION_DENIED') ? 1 : 2),
                  message: err.message,
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3
                };
                error(geolocationError);
              }
            });
        };
      }
      
      // 뒤로가기 버튼 존재 여부 확인 함수
      function checkBackButton() {
        try {
          let hasBack = false;
          
          // header 태그 내의 뒤로가기 버튼 우선 확인
          const headers = document.querySelectorAll('header');
          for (let header of headers) {
            const buttons = header.querySelectorAll('button, a');
            for (let btn of buttons) {
              // SVG 내부의 화살표 아이콘 확인
              const svg = btn.querySelector('svg');
              if (svg) {
                const paths = svg.querySelectorAll('path');
                for (let path of paths) {
                  const d = path.getAttribute('d') || '';
                  // ArrowLeft, ChevronLeft 등 왼쪽 화살표 패턴 확인
                  // 일반적인 왼쪽 화살표 패턴들
                  if (d.includes('M19 12H5') ||           // ArrowLeft 기본
                      d.includes('M15 18l-6-6') ||        // ArrowLeft/ChevronLeft
                      d.includes('M15 19l-7-7') ||        // ArrowLeft 변형
                      d.includes('M11 17l-6-6') ||         // ArrowLeft 변형
                      d.includes('M9 18l6-6') ||           // ChevronLeft
                      d.includes('M12 19l-7-7') ||         // 일반적인 왼쪽 화살표
                      d.includes('l-6-6') ||               // 왼쪽 화살표 일반 패턴
                      d.includes('l-7-7')) {               // 왼쪽 화살표 일반 패턴
                    hasBack = true;
                    break;
                  }
                }
                if (hasBack) break;
              }
              
              // 클래스명으로 확인
              const className = btn.className || '';
              if (className.includes('ArrowLeft') || 
                  className.includes('ChevronLeft') ||
                  className.includes('arrow-left') ||
                  className.includes('back')) {
                hasBack = true;
                break;
              }
              
              // href 속성으로 확인 (뒤로가기 링크)
              const href = btn.getAttribute('href') || '';
              if (href && (href.startsWith('/main') || 
                          href.startsWith('/mypage') || 
                          href.startsWith('/') && href !== window.location.pathname)) {
                // header 내의 링크는 뒤로가기로 간주
                hasBack = true;
                break;
              }
            }
            if (hasBack) break;
          }
          
          // header 외부의 뒤로가기 버튼도 확인 (예: Payment 페이지의 step 2)
          if (!hasBack) {
            const allButtons = document.querySelectorAll('button[onclick*="navigate"], button[onclick*="history"]');
            for (let btn of allButtons) {
              const onClick = btn.getAttribute('onclick') || '';
              if (onClick.includes('navigate(-1)') || 
                  onClick.includes('history.back()') ||
                  onClick.includes('navigate') && onClick.includes('Step')) {
                hasBack = true;
                break;
              }
            }
          }
          
          // React Native에 뒤로가기 버튼 존재 여부 전송
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'HAS_BACK_BUTTON',
              hasBackButton: hasBack
            }));
          }
        } catch (error) {
          // 오류 발생 시 기본값으로 false 전송
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'HAS_BACK_BUTTON',
              hasBackButton: false
            }));
          }
        }
      }
      
      // 페이지 로드 완료를 React Native에 알림
      function notifyPageLoaded() {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAGE_LOADED'
          }));
        }
        // 뒤로가기 버튼 확인
        setTimeout(checkBackButton, 300);
      }
      
      // DOM 변경 감지하여 뒤로가기 버튼 재확인
      const observer = new MutationObserver(() => {
        setTimeout(checkBackButton, 100);
      });
      
      // DOM이 로드되면 알림 및 뒤로가기 버튼 확인
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
          notifyPageLoaded();
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }, 100);
      } else {
        window.addEventListener('load', () => {
          notifyPageLoaded();
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        });
        document.addEventListener('DOMContentLoaded', () => {
          notifyPageLoaded();
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        });
      }
    })();
    true; // injected JavaScript는 항상 true를 반환해야 함
  `;

  if (WEB_URL === 'https://your-vercel-url.vercel.app') {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>환경 변수 설정 필요</Text>
          <Text style={styles.errorText}>
            .env 파일에 EXPO_PUBLIC_WEB_URL을 설정하거나{'\n'}
            app.json의 extra.webUrl을 설정해주세요.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onLoadProgress={handleLoadProgress}
        onError={handleError}
        onHttpError={handleHttpError}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={shouldStartLoadWithRequest}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsBackForwardNavigationGestures={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        // 모바일 User-Agent 설정 (카카오 OAuth가 모바일 환경으로 인식하도록)
        userAgent={getMobileUserAgent()}
        // Android WebView 최적화
        androidHardwareAccelerationDisabled={false}
        androidLayerType="hardware"
        // iOS WebView 최적화
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // 무한 로딩 방지를 위한 추가 설정
        incognito={false}
        originWhitelist={['*']}
      />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>오류 발생</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    maxWidth: '80%',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
