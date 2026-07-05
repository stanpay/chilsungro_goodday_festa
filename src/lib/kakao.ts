let kakaoLoaded = false;
export async function loadKakaoMaps(appKey?: string): Promise<typeof window & {
    kakao: any;
}> {
    if (typeof window === 'undefined')
        throw new Error('Window is undefined');
    const w = window as any;
    if (w.kakao?.maps && kakaoLoaded)
        return w;
    if (!appKey) {
        appKey = import.meta.env.VITE_KAKAO_APP_KEY;
    }
    if (!appKey) {
        const errorMsg = 'VITE_KAKAO_APP_KEY is not set. Please set the environment variable in your deployment platform (e.g., Vercel, Netlify) or .env file for local development.';
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
                resolve();
            };
            script.onerror = (e) => {
                reject(new Error('Failed to load Kakao Maps SDK - 가능한 원인: 1) 도메인 미등록 2) 잘못된 API 키 3) 네트워크 차단'));
            };
            document.head.appendChild(script);
        });
    }
    else {
        // 이미 스크립트가 로드되어 있는 경우, 로드 완료 대기
        await new Promise<void>((resolve) => {
            if (existing.complete) {
                resolve();
            }
            else {
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
                    resolve();
                });
            }
            else {
                // 이미 로드된 경우
                resolve();
            }
        }
        catch (e) {
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
        throw new Error('Kakao Maps services library failed to load');
    }
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
async function searchKeywordViaProxy(query: string, page: number, size: number): Promise<KakaoSearchResponse> {
    const url = new URL('/api/kakao/search', window.location.origin);
    url.searchParams.set('query', query);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('size', Math.min(size, 15).toString());
    const response = await fetch(url.toString());
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('카카오 REST API 키가 유효하지 않습니다. Vercel의 VITE_KAKAO_REST_API_KEY를 확인해주세요.');
        }
        if (response.status === 500) {
            const data = await response.json().catch(() => null);
            if (data?.error === 'Kakao REST API key not configured') {
                throw new Error('카카오 REST API 키가 서버에 설정되지 않았습니다. Vercel에 VITE_KAKAO_REST_API_KEY(또는 KAKAO_REST_API_KEY)를 설정해주세요.');
            }
        }
        throw new Error(`카카오 API 오류: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
/**
 * 카카오 로컬 API를 사용하여 주소/장소 검색 (서버 프록시 경유)
 * @param query 검색어 (동/읍/면 또는 장소명)
 * @param page 페이지 번호 (기본값: 1)
 * @param size 페이지당 결과 수 (기본값: 15, 최대 15)
 * @returns 검색 결과 목록
 */
export async function searchAddress(query: string, page: number = 1, size: number = 15): Promise<KakaoSearchResponse> {
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
            const data = await searchKeywordViaProxy(variant, page, size);
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
        }
        catch (error) {
            // 첫 번째 검색어가 아니면 에러를 무시하고 계속
            if (i > 0) {
                continue;
            }
            // 첫 번째 검색어 실패 시 다음 변형 시도
            if (i === 0 && searchVariants.length > 1) {
                continue;
            }
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
