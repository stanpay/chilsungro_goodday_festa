/**
 * 튜토리얼 상태 관리 유틸리티
 */

const TUTORIAL_COMPLETED_KEY = "tutorial_completed";
const TUTORIAL_STEP_KEY = "tutorial_step";

/**
 * 튜토리얼 완료 여부 확인
 */
export const isTutorialCompleted = (): boolean => {
  return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === "true";
};

/**
 * 튜토리얼 완료 처리
 */
export const completeTutorial = (): void => {
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, "true");
};

/**
 * 튜토리얼 완료 상태 초기화 (테스트용)
 */
export const resetTutorial = (): void => {
  localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
  localStorage.removeItem(TUTORIAL_STEP_KEY);
};

/**
 * 현재 튜토리얼 단계 가져오기
 */
export const getTutorialStep = (): string | null => {
  return localStorage.getItem(TUTORIAL_STEP_KEY);
};

/**
 * 튜토리얼 단계 설정
 */
export const setTutorialStep = (step: string | null): void => {
  if (step === null) {
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  } else {
    localStorage.setItem(TUTORIAL_STEP_KEY, step);
  }
};
