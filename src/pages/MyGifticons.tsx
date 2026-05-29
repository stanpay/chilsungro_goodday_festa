import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Gift, ArrowLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import BottomNav from "@/components/BottomNav";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import JsBarcode from "jsbarcode";
import { useGifticons, useRestoreGifticon } from "@/hooks/use-gifticons";
import { useAuth } from "@/contexts/AuthContext";
import type { Gifticon } from "@/api/gifticons";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";
type SortOrder = "유효기간임박순" | "구매일순" | "낮은가격순" | "높은가격순" | "사용일순";
const MyGifticons = () => {
    const { toast } = useToast();
    const { isLoggedIn } = useAuth();
    const [searchParams] = useSearchParams();
    const [filterStatus, setFilterStatus] = useState<"사용 가능" | "완료/만료">("사용 가능");
    const [subFilter, setSubFilter] = useState<"전체" | "사용완료" | "판매완료" | "기한만료">("전체");
    const [sortOrder, setSortOrder] = useState<SortOrder>("유효기간임박순");
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [restoreTargetGifticon, setRestoreTargetGifticon] = useState<Gifticon | null>(null);
    const [selectedGifticon, setSelectedGifticon] = useState<Gifticon | null>(null);
    const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
    const { data: gifticons = [], isLoading } = useGifticons();
    const restoreMutation = useRestoreGifticon();
    const handleFilterStatusChange = (newFilterStatus: "사용 가능" | "완료/만료") => {
        setFilterStatus(newFilterStatus);
        setSubFilter("전체");
        setSortOrder(newFilterStatus === "완료/만료" ? "사용일순" : "유효기간임박순");
    };
    useEffect(() => {
        const filter = searchParams.get("filter") as "사용 가능" | "완료/만료" | null;
        const subFilterParam = searchParams.get("subFilter") as typeof subFilter | null;
        if (filter) {
            setFilterStatus(filter);
            setSubFilter("전체");
            setSortOrder(filter === "완료/만료" ? "사용일순" : "유효기간임박순");
        }
        if (subFilterParam)
            setSubFilter(subFilterParam);
    }, [searchParams]);
    const isExpired = (g: Gifticon) => {
        const expiryDate = new Date(g.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate < today;
    };
    const filteredGifticons = gifticons.filter((g) => {
        if (filterStatus === "사용 가능") {
            if (g.status !== "사용가능")
                return false;
            if (isExpired(g))
                return false;
            return subFilter === "전체";
        }
        else {
            if (subFilter === "전체") {
                if (g.status === "사용완료" || g.status === "판매완료")
                    return true;
                return g.status === "사용가능" && isExpired(g);
            }
            if (subFilter === "사용완료")
                return g.status === "사용완료";
            if (subFilter === "판매완료")
                return g.status === "판매완료";
            if (subFilter === "기한만료") {
                return g.status === "사용가능" && isExpired(g);
            }
            return true;
        }
    });
    const sortedGifticons = [...filteredGifticons].sort((a, b) => {
        switch (sortOrder) {
            case "유효기간임박순":
                return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
            case "구매일순":
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            case "낮은가격순":
                return a.original_price - b.original_price;
            case "높은가격순":
                return b.original_price - a.original_price;
            case "사용일순": {
                const dateA = new Date(a.updated_at || a.created_at).getTime();
                const dateB = new Date(b.updated_at || b.created_at).getTime();
                return dateB - dateA;
            }
            default:
                return 0;
        }
    });
    const handleGifticonClick = (g: Gifticon) => {
        if (g.status === "판매완료") {
            toast({ title: "접근 불가", description: "판매완료된 기프티콘은 더 이상 확인할 수 없습니다.", variant: "destructive" });
            return;
        }
        if (!g.barcode) {
            toast({ title: "바코드 없음", description: "이 기프티콘에는 바코드가 없습니다.", variant: "destructive" });
            return;
        }
        setSelectedGifticon(g);
        setIsBarcodeDialogOpen(true);
    };
    const BarcodeDisplay = ({ number }: {
        number: string;
    }) => {
        const svgRef = useRef<SVGSVGElement>(null);
        useEffect(() => {
            if (!svgRef.current || !number)
                return;
            try {
                const barcodeNumber = number.replace(/\D/g, "");
                if (!barcodeNumber)
                    return;
                const format = barcodeNumber.length === 13
                    ? "EAN13"
                    : barcodeNumber.length === 8
                        ? "EAN8"
                        : "CODE128";
                try {
                    JsBarcode(svgRef.current, barcodeNumber, { format, width: 2, height: 80, displayValue: false, background: "transparent", lineColor: "#000000", margin: 0 });
                }
                catch {
                    JsBarcode(svgRef.current, barcodeNumber, { format: "CODE128", width: 2, height: 80, displayValue: false, background: "transparent", lineColor: "#000000", margin: 0 });
                }
            }
            catch (e) {
            }
        }, [number]);
        return (<div className="space-y-1">
        <div className="flex items-center justify-center bg-white p-3 rounded-lg">
          <svg ref={svgRef} className="max-w-full h-20" style={{ maxHeight: "80px" }}/>
        </div>
        <p className="text-center font-mono text-xs tracking-widest">{number}</p>
      </div>);
    };
    if (isLoading) {
        return (<div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>);
    }
    if (isBarcodeDialogOpen && selectedGifticon) {
        return (<div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="max-w-md mx-auto py-4 px-4 relative">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setIsBarcodeDialogOpen(false); setSelectedGifticon(null); }}>
              <ArrowLeft className="w-5 h-5"/>
            </Button>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-6">
          <Card className="p-4 rounded-2xl border-border/50">
            <div className="space-y-3">
              <BarcodeDisplay number={selectedGifticon.barcode || ""}/>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-4 h-4 text-primary"/>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">기프티콘</p>
                  <p className="font-bold text-sm">{selectedGifticon.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedGifticon.original_price.toLocaleString()}원</p>
                </div>
              </div>
            </div>
          </Card>
        </main>
      </div>);
    }
    return (<div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      {/* Filter Tabs */}
      <div className="max-w-md mx-auto px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button variant={filterStatus === "사용 가능" ? "default" : "outline"} className="flex-1 min-w-[80px]" onClick={() => handleFilterStatusChange("사용 가능")}>
            사용 가능
          </Button>
          <Button variant={filterStatus === "완료/만료" ? "default" : "outline"} className="flex-1 min-w-[80px]" onClick={() => handleFilterStatusChange("완료/만료")}>
            완료/만료
          </Button>
        </div>
      </div>

      {/* Sub Filter Chips */}
      <div className="max-w-md mx-auto px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {filterStatus === "사용 가능" && (<>
              <Badge variant={subFilter === "전체" ? "default" : "outline"} className="cursor-pointer px-3 py-1" onClick={() => setSubFilter("전체")}>전체</Badge>
            </>)}
          {filterStatus === "완료/만료" && (<>
              {(["전체", "사용완료", "판매완료", "기한만료"] as const).map((f) => (<Badge key={f} variant={subFilter === f ? "default" : "outline"} className="cursor-pointer px-3 py-1" onClick={() => setSubFilter(f)}>{f}</Badge>))}
            </>)}
        </div>
      </div>

      {/* Sort Bar */}
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">전체 브랜드</span>
          <span className="text-muted-foreground">▼</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
              <ArrowUpDown className="w-4 h-4"/>
              <span className="text-sm">{sortOrder}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {filterStatus === "사용 가능" ? (<>
                <DropdownMenuItem onClick={() => setSortOrder("유효기간임박순")}>유효기간임박순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("구매일순")}>구매일 순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("낮은가격순")}>낮은가격순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("높은가격순")}>높은가격순</DropdownMenuItem>
              </>) : (<>
                <DropdownMenuItem onClick={() => setSortOrder("사용일순")}>사용일 순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("구매일순")}>구매일 순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("낮은가격순")}>낮은가격순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("높은가격순")}>높은가격순</DropdownMenuItem>
              </>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Gifticons Grid */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          {sortedGifticons.length === 0 ? (<div className="col-span-2 text-center py-12 text-muted-foreground">기프티콘이 없습니다</div>) : (sortedGifticons.map((g) => (<Card key={g.id} className="w-full cursor-pointer transition-shadow hover:shadow-lg" onClick={() => handleGifticonClick(g)}>
                <div className="aspect-square bg-card flex items-center justify-center p-4 border-b border-border relative overflow-hidden">
                  <div className="text-7xl">{g.image}</div>
                  {filterStatus === "완료/만료" && (<>
                      {g.status === "사용완료" && (<div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="secondary" className="whitespace-nowrap text-sm">사용완료</Badge>
                        </div>)}
                      {g.status === "판매완료" && (<div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="outline" className="whitespace-nowrap text-sm">판매완료</Badge>
                        </div>)}
                      {g.status === "사용가능" && isExpired(g) && (<div className="absolute inset-0 bg-destructive/60 flex items-center justify-center">
                          <Badge variant="destructive" className="whitespace-nowrap text-sm">기한만료</Badge>
                        </div>)}
                    </>)}
                </div>
                <div className="p-3 space-y-2">
                  <AutoFitMarquee as="p" text={g.brand} textClassName="text-muted-foreground" fontSizeClasses={["text-sm", "text-xs"]}/>
                  <AutoFitMarquee as="p" text={g.name} textClassName="font-medium" fontSizeClasses={["text-sm", "text-xs"]}/>
                  <p className="text-lg font-bold text-foreground">
                    {g.original_price.toLocaleString()}<span className="text-sm font-normal">원</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~{new Date(g.expiry_date).toLocaleDateString("ko-KR")}
                  </p>
                  {filterStatus === "완료/만료" && (<>
                      {g.status === "판매완료" ? (<div className="text-xs text-muted-foreground text-center mt-2">판매 완료된 기프티콘입니다</div>) : (<Button variant="outline" size="sm" className="w-full mt-2" onClick={(e) => {
                        e.stopPropagation();
                        setRestoreTargetGifticon(g);
                        setRestoreDialogOpen(true);
                    }} disabled={!isLoggedIn || g.status === "판매완료"}>
                          복구
                        </Button>)}
                    </>)}
                </div>
              </Card>)))}
        </div>
      </div>

      {/* 복구 확인 모달 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>복구 확인</DialogTitle>
            <DialogDescription>
              {restoreTargetGifticon && (restoreTargetGifticon.status === "사용완료" ? (<span>이 기프티콘은 <span className="font-bold">사용완료</span>된 기프티콘입니다. 복구 하시겠습니까?</span>) : isExpired(restoreTargetGifticon) ? (<span>이 기프티콘은 <span className="font-bold text-destructive">만료</span>된 기프티콘입니다. 정말로 복구하시겠습니까?</span>) : "정말로 복구하시겠습니까?")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRestoreDialogOpen(false); setRestoreTargetGifticon(null); }}>취소</Button>
            <Button onClick={() => {
            if (!restoreTargetGifticon)
                return;
            restoreMutation.mutate(restoreTargetGifticon.id, {
                onSuccess: () => {
                    setRestoreDialogOpen(false);
                    setRestoreTargetGifticon(null);
                    setFilterStatus("사용 가능");
                    setSubFilter("전체");
                },
            });
        }} disabled={restoreMutation.isPending}>
              복구
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>);
};
export default MyGifticons;
