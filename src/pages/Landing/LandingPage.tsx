import { Button } from "@/components/ui/button";
import { Download, Gift, Users, Zap, Package, CreditCard } from "lucide-react";

const LandingPage = () => {
  // 앱 다운로드 링크 (환경변수 또는 플레이스홀더)
  const appDownloadLink = import.meta.env.VITE_APP_DOWNLOAD_LINK || "#";
  
  // 현재 사이트 URL (iframe용)
  const siteUrl = window.location.origin;
  const tutorialUrl = `${siteUrl}/tutorial`;

  const handleDownload = () => {
    if (appDownloadLink && appDownloadLink !== "#") {
      window.open(appDownloadLink, "_blank");
    } else {
      // 플레이스홀더: 로그인 페이지로 이동
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/50 py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
              할인부터 적립, 결제까지<br />
              한번에
            </h1>
            <p className="text-2xl md:text-3xl font-semibold mb-4 text-primary">
              AI 개인화 할인 비서 stan
            </p>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              기프티콘을 넘어 할인, 적립, 결제까지 원스톱 솔루션
            </p>
            <Button
              onClick={handleDownload}
              size="lg"
              className="text-lg px-8 py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              <Download className="w-5 h-5 mr-2" />
              지금 바로 설치하고 첫구매 무료 혜택받기
            </Button>
          </div>
        </div>
      </section>

      {/* 혜택 섹션 */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              특별한 혜택
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-background rounded-2xl p-8 border border-border shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">첫구매 무료</h3>
                </div>
                <p className="text-muted-foreground text-lg">
                  첫 구매 시 무료로 제공되는 특별한 혜택을 받아보세요
                </p>
              </div>
              <div className="bg-background rounded-2xl p-8 border border-border shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">친구추천 시 쿠폰 제공</h3>
                </div>
                <p className="text-muted-foreground text-lg">
                  친구를 초대하면 양쪽 모두에게 쿠폰을 드립니다
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 비교 섹션 */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              평균 8단계인 타사앱과 다르게
            </h2>
            <p className="text-xl md:text-2xl font-semibold text-center mb-12 text-primary">
              3단계만에 해결
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {/* 타사앱 1 */}
              <div className="bg-card rounded-2xl p-6 border border-border text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-2xl flex items-center justify-center">
                  <img
                    src="/placeholder.svg"
                    alt="타사앱"
                    className="w-16 h-16 object-contain opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">평균 8단계</p>
              </div>

              {/* 타사앱 2 */}
              <div className="bg-card rounded-2xl p-6 border border-border text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-2xl flex items-center justify-center">
                  <img
                    src="/placeholder.svg"
                    alt="타사앱"
                    className="w-16 h-16 object-contain opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">평균 8단계</p>
              </div>

              {/* 타사앱 3 */}
              <div className="bg-card rounded-2xl p-6 border border-border text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-2xl flex items-center justify-center">
                  <img
                    src="/placeholder.svg"
                    alt="타사앱"
                    className="w-16 h-16 object-contain opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                  <div className="h-2 bg-muted rounded-full"></div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">평균 8단계</p>
              </div>
            </div>

            {/* Stan - 3단계 */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 border-2 border-primary/20 text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Zap className="w-8 h-8 text-primary" />
                <h3 className="text-2xl md:text-3xl font-bold">Stan</h3>
              </div>
              <div className="space-y-2 max-w-xs mx-auto">
                <div className="h-3 bg-primary rounded-full"></div>
                <div className="h-3 bg-primary rounded-full"></div>
                <div className="h-3 bg-primary rounded-full"></div>
              </div>
              <p className="text-lg font-semibold text-primary mt-6">단 3단계로 해결</p>
            </div>
          </div>
        </div>
      </section>

      {/* 체험 섹션 - 튜토리얼 iframe */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              3단계만에 해결
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-8">
              직접 체험해보세요
            </p>
            <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-xl">
              <div className="aspect-video w-full">
                <iframe
                  src={tutorialUrl}
                  className="w-full h-full border-0"
                  title="Stan 튜토리얼 체험"
                  allow="geolocation"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              내 기프티콘 통합관리
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-2xl p-8 border border-border text-center hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">기프티콘 통합관리</h3>
                <p className="text-muted-foreground">
                  모든 기프티콘을 한 곳에서 관리하고 사용하세요
                </p>
              </div>
              <div className="bg-card rounded-2xl p-8 border border-border text-center hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI 개인화 할인</h3>
                <p className="text-muted-foreground">
                  나만을 위한 맞춤형 할인 정보를 제공합니다
                </p>
              </div>
              <div className="bg-card rounded-2xl p-8 border border-border text-center hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">원스톱 결제</h3>
                <p className="text-muted-foreground">
                  할인, 적립, 결제까지 한 번에 처리하세요
                </p>
              </div>
            </div>
            <div className="mt-12 text-center">
              <p className="text-xl md:text-2xl font-semibold text-foreground mb-4">
                기프티콘을 넘어 할인, 적립, 결제까지 원스톱 솔루션
              </p>
              <Button
                onClick={handleDownload}
                size="lg"
                className="text-lg px-8 py-6 h-auto font-semibold"
              >
                <Download className="w-5 h-5 mr-2" />
                지금 바로 시작하기
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-2xl font-bold mb-2 text-primary">Stan</p>
            <p className="text-muted-foreground">할인의 기준이 되다</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
