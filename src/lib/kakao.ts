let kakaoLoaded = false;

export async function loadKakaoMaps(appKey?: string): Promise<typeof window & { kakao: any }> {
  if (typeof window === 'undefined') throw new Error('Window is undefined');
  const w = window as any;
  if (w.kakao?.maps && kakaoLoaded) return w;

  if (!appKey) {
    appKey = (import.meta as any).env?.VITE_KAKAO_APP_KEY;
  }
  if (!appKey) {
    const errorMsg = 'VITE_KAKAO_APP_KEY is not set. Please set the environment variable in your deployment platform (e.g., Vercel, Netlify) or .env file for local development.';
    console.error('❌ [Kakao SDK]', errorMsg);
    throw new Error(errorMsg);
  }

  // 이미 로딩 중인 스크립트가 있으면 대기
  const existing = document.querySelector('script[data-kakao-maps="true"]') as HTMLScriptElement | null;
  if (!existing) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.setAttribute('data-kakao-maps', 'true');
      script.async = true;
      script.defer = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
      script.onload = () => {
        console.log('✅ [Kakao SDK] 스크립트 로드 완료');
        resolve();
      };
      script.onerror = (e) => {
        console.error('❌ [Kakao SDK] 스크립트 로드 실패');
        console.error('Script URL:', script.src);
        console.error('Error event:', e);
        console.error('App Key 설정 여부:', !!appKey);
        reject(new Error('Failed to load Kakao Maps SDK - 가능한 원인: 1) 도메인 미등록 2) 잘못된 API 키 3) 네트워크 차단'));
      };
      document.head.appendChild(script);
    });
  } else {
    // 이미 스크립트가 로드되어 있는 경우, 로드 완료 대기
    await new Promise<void>((resolve) => {
      if (existing.complete) {
        resolve();
      } else {
        existing.onload = () => resolve();
      }
    });
  }

  // kakao 객체가 사용 가능할 때까지 대기
  let retries = 0;
  const maxRetries = 50; // 최대 5초
  while (!(window as any).kakao && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  const w2 = window as any;
  if (!w2.kakao) {
    throw new Error('Kakao SDK 객체를 찾을 수 없습니다');
  }

  // kakao.maps.load() 호출 (autoload=false이므로 수동 호출 필요)
  if (!w2.kakao.maps) {
    throw new Error('Kakao Maps SDK를 찾을 수 없습니다');
  }

  await new Promise<void>((resolve, reject) => {
    try {
      if (w2.kakao.maps.load) {
        w2.kakao.maps.load(() => {
          console.log('✅ [Kakao SDK] kakao.maps.load() 완료');
          resolve();
        });
      } else {
        // 이미 로드된 경우
        resolve();
      }
    } catch (e) {
      reject(new Error('Kakao maps load failed: ' + (e as Error).message));
    }
  });

  // services 라이브러리가 로드되었는지 확인 (최대 5초 대기)
  retries = 0;
  while (!w2.kakao?.maps?.services && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (!w2.kakao?.maps?.services) {
    console.error('❌ [Kakao SDK] services 라이브러리를 찾을 수 없습니다');
    console.error('Kakao 객체:', w2.kakao);
    console.error('Kakao maps:', w2.kakao?.maps);
    throw new Error('Kakao Maps services library failed to load');
  }

  console.log('✅ [Kakao SDK] services 라이브러리 로드 완료');
  kakaoLoaded = true;
  return window as any;
}

// 카카오 로컬 API 타입 정의
export interface KakaoSearchResult {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  category_name: string;
  place_url: string;
}

export interface KakaoSearchResponse {
  documents: KakaoSearchResult[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
}

/**
 * 검색어 변형 생성 (도로명 주소 검색 개선)
 * 예: "도제원로41" → ["도제원로41", "도제원로41번길", "도제원로41길"]
 */
function generateSearchVariants(query: string): string[] {
  const trimmed = query.trim();
  const variants: string[] = [trimmed]; // 원본 검색어는 항상 포함

  // 숫자로 끝나는 경우 도로명 접미사 추가
  const numberSuffixMatch = trimmed.match(/^(.+?)(\d+)$/);
  if (numberSuffixMatch) {
    const [, prefix, number] = numberSuffixMatch;
    // "번길", "길" 등의 접미사가 없을 때만 추가
    if (!trimmed.match(/(번길|길|로|대로)$/)) {
      variants.push(`${prefix}${number}번길`);
      variants.push(`${prefix}${number}길`);
    }
  }

  return variants;
}

/**
 * 카카오 로컬 API를 사용하여 주소/장소 검색
 * @param query 검색어 (동/읍/면 또는 장소명)
 * @param page 페이지 번호 (기본값: 1)
 * @param size 페이지당 결과 수 (기본값: 15, 최대 15)
 * @returns 검색 결과 목록
 */
export async function searchAddress(
  query: string,
  page: number = 1,
  size: number = 15
): Promise<KakaoSearchResponse> {
  // 여러 가능한 환경 변수 이름 확인 (REST API 키 우선, 없으면 APP_KEY 사용)
  // 환경 변수에서 공백과 따옴표 제거
  const getEnvValue = (key: string): string | undefined => {
    const value = import.meta.env[key];
    if (typeof value === 'string') {
      return value.trim().replace(/^["']|["']$/g, '');
    }
    return value;
  };

  const restApiKey = 
    getEnvValue('VITE_KAKAO_REST_API_KEY') ||
    getEnvValue('VITE_KAKAO_API_KEY') ||
    getEnvValue('VITE_KAKAO_REST_KEY') ||
    getEnvValue('VITE_KAKAO_KEY') ||
    getEnvValue('VITE_KAKAO_APP_KEY'); // JavaScript 키도 시도 (일부 경우 동일할 수 있음)
  
  // 디버깅: 환경 변수 로딩 확인 (개발 환경에서만)
  if (import.meta.env.DEV) {
    console.log('🔍 [카카오 API] 환경 변수 확인:', {
      VITE_KAKAO_REST_API_KEY: getEnvValue('VITE_KAKAO_REST_API_KEY') ? `✅ ${getEnvValue('VITE_KAKAO_REST_API_KEY')?.substring(0, 8)}...` : '❌ 없음',
      VITE_KAKAO_APP_KEY: getEnvValue('VITE_KAKAO_APP_KEY') ? `✅ ${getEnvValue('VITE_KAKAO_APP_KEY')?.substring(0, 8)}...` : '❌ 없음',
      사용할_키: restApiKey ? `✅ ${restApiKey.substring(0, 8)}... (길이: ${restApiKey.length})` : '❌ 없음',
    });
  }
  
  if (!restApiKey) {
    const errorMsg = '카카오 REST API 키가 설정되지 않았습니다. 카카오 개발자 콘솔(https://developers.kakao.com)에서 REST API 키를 발급받아 .env 파일에 VITE_KAKAO_REST_API_KEY를 설정해주세요.';
    console.error('❌ [카카오 API]', errorMsg);
    throw new Error(errorMsg);
  }
  
  // API 키 유효성 검사 (빈 문자열 체크)
  if (restApiKey.trim().length === 0) {
    const errorMsg = '카카오 REST API 키가 비어있습니다. .env 파일에서 VITE_KAKAO_REST_API_KEY 값을 확인해주세요.';
    console.error('❌ [카카오 API]', errorMsg);
    throw new Error(errorMsg);
  }

  if (!query || query.trim().length === 0) {
    return {
      documents: [],
      meta: {
        total_count: 0,
        pageable_count: 0,
        is_end: true,
      },
    };
  }

  // 검색어 변형 생성
  const searchVariants = generateSearchVariants(query);
  const allResults: KakaoSearchResult[] = [];
  const seenPlaceIds = new Set<string>();

  // 여러 변형으로 검색 시도
  for (let i = 0; i < searchVariants.length; i++) {
    const variant = searchVariants[i];
    try {
      const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
      url.searchParams.append('query', variant);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('size', Math.min(size, 15).toString());

      // Authorization 헤더 생성 (공백 제거)
      const authHeader = `KakaoAK ${restApiKey.trim()}`;
      
      // 디버깅: 요청 정보 로깅 (개발 환경에서만)
      if (import.meta.env.DEV && i === 0) {
        console.log('🔍 [카카오 API] 요청 정보:', {
          url: url.toString(),
          authHeader: `${authHeader.substring(0, 20)}...`,
          apiKeyLength: restApiKey.trim().length,
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        // 첫 번째 검색어가 실패하면 다음 변형 시도
        if (i === 0 && searchVariants.length > 1) {
          continue;
        }
        
        // 401 오류인 경우 더 명확한 에러 메시지 제공
        if (response.status === 401) {
          const errorText = await response.text().catch(() => '응답 본문을 읽을 수 없습니다');
          const errorMsg = `카카오 REST API 인증 실패 (401). API 키를 확인해주세요. 
- 카카오 개발자 콘솔(https://developers.kakao.com)에서 REST API 키 확인
- .env 파일에 VITE_KAKAO_REST_API_KEY 설정 확인
- API 키에 공백이나 따옴표가 포함되지 않았는지 확인
- 도메인이 카카오 개발자 콘솔에 등록되어 있는지 확인
응답: ${errorText}`;
          console.error('❌ [카카오 API]', errorMsg);
          console.error('❌ [카카오 API] 사용된 API 키:', restApiKey ? `${restApiKey.substring(0, 8)}...` : '없음');
          throw new Error('카카오 REST API 키가 유효하지 않습니다. 카카오 개발자 콘솔에서 REST API 키를 확인해주세요.');
        }
        
        throw new Error(`카카오 API 오류: ${response.status} ${response.statusText}`);
      }

      const data: KakaoSearchResponse = await response.json();
      
      // 중복 제거하면서 결과 추가
      for (const doc of data.documents) {
        const placeId = doc.place_name + doc.address_name;
        if (!seenPlaceIds.has(placeId)) {
          seenPlaceIds.add(placeId);
          allResults.push(doc);
        }
      }

      // 첫 번째 검색어로 결과가 충분하면 중단
      if (i === 0 && allResults.length >= size) {
        break;
      }
      
      // 결과가 충분하면 중단
      if (allResults.length >= size) {
        break;
      }
    } catch (error) {
      // 첫 번째 검색어가 아니면 에러를 무시하고 계속
      if (i > 0) {
        continue;
      }
      // 첫 번째 검색어 실패 시 다음 변형 시도
      if (i === 0 && searchVariants.length > 1) {
        continue;
      }
      // 마지막 변형도 실패하면 에러 던지기
      console.error('주소 검색 오류:', error);
      throw error;
    }
  }

  return {
    documents: allResults.slice(0, size),
    meta: {
      total_count: allResults.length,
      pageable_count: allResults.length,
      is_end: true,
    },
  };
}
