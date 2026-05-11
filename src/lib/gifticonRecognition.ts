// 더미 기프티콘 인식 데이터 생성 함수
// 나중에 OCR API가 준비되면 이 함수를 실제 API 호출로 교체

export interface RecognitionResult {
  productName: string;
  brand: string;
  originalPrice: number;
  expiryDate?: string;
  barcode?: string;
}

// 더미 상품 데이터 리스트
const DUMMY_PRODUCTS: RecognitionResult[] = [
  { productName: "스타벅스 아메리카노 Tall", brand: "스타벅스", originalPrice: 4500 },
  { productName: "스타벅스 카페라떼 Grande", brand: "스타벅스", originalPrice: 5100 },
  { productName: "스타벅스 카푸치노 Venti", brand: "스타벅스", originalPrice: 5900 },
  { productName: "스타벅스 바닐라라떼 Tall", brand: "스타벅스", originalPrice: 5100 },
  { productName: "투썸플레이스 아메리카노", brand: "투썸플레이스", originalPrice: 4000 },
  { productName: "투썸플레이스 카페라떼", brand: "투썸플레이스", originalPrice: 4500 },
  { productName: "투썸플레이스 카푸치노", brand: "투썸플레이스", originalPrice: 5000 },
  { productName: "파스쿠찌 아메리카노", brand: "파스쿠찌", originalPrice: 4000 },
  { productName: "파스쿠찌 카페라떼", brand: "파스쿠찌", originalPrice: 4500 },
  { productName: "메가커피 아메리카노", brand: "메가커피", originalPrice: 2000 },
  { productName: "메가커피 카페라떼", brand: "메가커피", originalPrice: 2500 },
  { productName: "이디야 아메리카노", brand: "이디야", originalPrice: 3000 },
  { productName: "이디야 카페라떼", brand: "이디야", originalPrice: 3500 },
  { productName: "빽다방 아메리카노", brand: "빽다방", originalPrice: 2000 },
  { productName: "빽다방 카페라떼", brand: "빽다방", originalPrice: 2500 },
  { productName: "컴포즈커피 아메리카노", brand: "컴포즈커피", originalPrice: 2000 },
  { productName: "컴포즈커피 카페라떼", brand: "컴포즈커피", originalPrice: 2500 },
  { productName: "베스킨라빈스 싱글", brand: "베스킨라빈스", originalPrice: 3500 },
  { productName: "베스킨라빈스 더블", brand: "베스킨라빈스", originalPrice: 5000 },
];

/**
 * 더미 인식 데이터 생성
 * @returns 인식 결과 객체
 */
export function generateDummyRecognitionData(): RecognitionResult {
  // 랜덤하게 상품 선택
  const randomIndex = Math.floor(Math.random() * DUMMY_PRODUCTS.length);
  const selectedProduct = DUMMY_PRODUCTS[randomIndex];
  
  // 유효기한 생성 (현재 날짜로부터 1년 후)
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  
  return {
    ...selectedProduct,
    expiryDate: expiryDate.toISOString().split('T')[0], // YYYY-MM-DD 형식
    barcode: generateDummyBarcode(),
  };
}

/**
 * 더미 바코드 생성 (13자리)
 */
function generateDummyBarcode(): string {
  let barcode = '';
  for (let i = 0; i < 13; i++) {
    barcode += Math.floor(Math.random() * 10).toString();
  }
  return barcode;
}

/**
 * 나중에 OCR API가 준비되면 이 함수를 사용
 * @param file 이미지 파일
 * @returns 인식 결과 Promise
 */
export async function recognizeGifticon(file: File): Promise<RecognitionResult> {
  // TODO: 실제 OCR API 호출로 교체
  // 현재는 더미 데이터 반환
  // file 파라미터는 나중에 OCR API 호출 시 사용
  return new Promise((resolve) => {
    // 인식 처리 시뮬레이션을 위한 약간의 지연
    setTimeout(() => {
      resolve(generateDummyRecognitionData());
    }, 500);
  });
}