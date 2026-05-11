import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ArrowUpDown, Plus, Gift, ArrowLeft } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BottomNav from "@/components/BottomNav";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import JsBarcode from "jsbarcode";

interface Gifticon {
  id: string;
  brand: string;
  name: string;
  originalPrice: number;
  image: string;
  expiryDate: string;
  status: "사용가능" | "사용완료" | "판매완료";
  isSelling: boolean;
  barcode?: string;
  expiryDateRaw?: string; // 원본 날짜 문자열 (기한만료 체크용)
  salePrice?: number; // 판매 가격 (used_gifticons에서 가져옴)
  createdAt?: string; // 구매일 (created_at)
  updatedAt?: string; // 사용일 (updated_at)
}

type SortOrder = "유효기간임박순" | "구매일순" | "낮은가격순" | "높은가격순" | "사용일순";

const MyGifticons = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<"사용 가능" | "완료/만료">("사용 가능");
  const [subFilter, setSubFilter] = useState<"전체" | "보유중" | "판매중" | "사용완료" | "판매완료" | "기한만료">("전체");
  const [sortOrder, setSortOrder] = useState<SortOrder>("유효기간임박순");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetGifticon, setRestoreTargetGifticon] = useState<Gifticon | null>(null);

  // 메인 필터 변경 시 서브 필터 초기화 및 정렬 기본값 설정
  const handleFilterStatusChange = (newFilterStatus: "사용 가능" | "완료/만료") => {
    setFilterStatus(newFilterStatus);
    setSubFilter("전체");
    // 완료/만료 탭으로 전환 시 기본 정렬을 사용일순으로 설정
    if (newFilterStatus === "완료/만료") {
      setSortOrder("사용일순");
    } else {
      setSortOrder("유효기간임박순");
    }
  };
  const [gifticons, setGifticons] = useState<Gifticon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedGifticon, setSelectedGifticon] = useState<Gifticon | null>(null);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [sellingGifticon, setSellingGifticon] = useState<Gifticon | null>(null);
  const [salePrice, setSalePrice] = useState<string>("");

  useEffect(() => {
    const filter = searchParams.get("filter") as "사용 가능" | "완료/만료" | null;
    const subFilterParam = searchParams.get("subFilter") as "전체" | "보유중" | "판매중" | "사용완료" | "판매완료" | "기한만료" | null;

    if (filter) {
      setFilterStatus(filter);
      // 메인 필터 변경 시 서브 필터를 전체로 초기화
      setSubFilter("전체");
      // 완료/만료 탭으로 전환 시 기본 정렬을 사용일순으로 설정
      if (filter === "완료/만료") {
        setSortOrder("사용일순");
      } else {
        setSortOrder("유효기간임박순");
      }
    }
    if (subFilterParam) {
      setSubFilter(subFilterParam);
    }
  }, [searchParams]);

  const checkPendingRecognition = async (session: any) => {
    try {
      // 로컬 스토리지에서 pending_job_id 확인
      const pendingJobId = localStorage.getItem('pending_recognition_job_id');
      
      if (pendingJobId) {
        // 인식 작업이 완료되었는지 확인
        const { data: jobData, error } = await supabase
          .from('gifticon_recognition_jobs')
          .select('id, status, recognition_result')
          .eq('id', pendingJobId)
          .eq('user_id', session.user.id)
          .single();

        if (!error && jobData) {
          if (jobData.status === 'failed') {
            // 인식 실패 케이스 - 바로 결과 페이지로 리다이렉트
            navigate(`/sell/result/${pendingJobId}`);
            return true;
          } else if (jobData.status === 'completed' && jobData.recognition_result) {
            // 인식이 완료되었고 아직 처리되지 않은 경우
            // gifticons 테이블에 등록되었는지 확인
            const result = jobData.recognition_result as any;
            
            // recognition_result의 정보로 gifticons 테이블에서 확인
            const { data: existingGifticon } = await supabase
              .from('gifticons')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('name', result.productName)
              .eq('brand', result.brand)
              .eq('original_price', result.originalPrice)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            // 등록되지 않았다면 인식 결과 페이지로 리다이렉트
            if (!existingGifticon) {
              navigate(`/sell/result/${pendingJobId}`);
              return true;
            } else {
              // 이미 등록되었다면 pending_job_id 삭제
              localStorage.removeItem('pending_recognition_job_id');
            }
          } else if (jobData.status !== 'completed' && jobData.status !== 'failed') {
            // 아직 인식이 완료되지 않은 경우 pending_job_id 유지
            // (인식이 완료되면 자동으로 결과 페이지로 이동할 것)
          } else {
            // 작업이 없거나 오류가 있는 경우 pending_job_id 삭제
            localStorage.removeItem('pending_recognition_job_id');
          }
        } else {
          // 작업이 없거나 오류가 있는 경우 pending_job_id 삭제
          localStorage.removeItem('pending_recognition_job_id');
        }
      } else {
        // 로컬 스토리지에 없으면 DB에서 최근 완료/실패된 작업 확인
        const { data: recentJob, error: recentError } = await supabase
          .from('gifticon_recognition_jobs')
          .select('id, status, recognition_result, created_at')
          .eq('user_id', session.user.id)
          .in('status', ['completed', 'failed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!recentError && recentJob) {
          if (recentJob.status === 'failed') {
            // 실패한 작업이 있으면 바로 리다이렉트
            localStorage.setItem('pending_recognition_job_id', recentJob.id);
            navigate(`/sell/result/${recentJob.id}`);
            return true;
          } else if (recentJob.status === 'completed' && recentJob.recognition_result) {
            const result = recentJob.recognition_result as any;
            
            // 해당 작업으로 등록된 기프티콘이 있는지 확인
            const { data: existingGifticon } = await supabase
              .from('gifticons')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('name', result.productName)
              .eq('brand', result.brand)
              .eq('original_price', result.originalPrice)
              .gte('created_at', recentJob.created_at || new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            // 등록되지 않았다면 인식 결과 페이지로 리다이렉트
            if (!existingGifticon) {
              localStorage.setItem('pending_recognition_job_id', recentJob.id);
              navigate(`/sell/result/${recentJob.id}`);
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.error('미완료 인식 작업 확인 오류:', error);
    }
    return false;
  };

  const loadGifticons = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      setIsLoggedIn(true);
      
      // 미완료 인식 작업 확인 (우선 처리)
      const hasPending = await checkPendingRecognition(session);
      if (hasPending) {
        setLoading(false);
        return; // 리다이렉트되면 로딩 중지
      }
      
      // Load user's gifticons from database
      const { data: gifticonsData, error: gifticonsError } = await supabase
        .from('gifticons')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (gifticonsError) {
        console.error("기프티콘 로드 오류:", gifticonsError);
        setLoading(false);
        return;
      }

      console.log("서버에서 불러온 기프티콘 데이터:", gifticonsData);

      // Load used_gifticons for selling status (id로 조인)
      const gifticonIds = gifticonsData?.map(g => g.id) || [];
      let usedGifticonsMap = new Map<string, { sale_price: number; status: string }>();
      
      if (gifticonIds.length > 0) {
        const { data: usedGifticonsData, error: usedGifticonsError } = await supabase
          .from('used_gifticons')
          .select('id, sale_price, status')
          .in('id', gifticonIds);

        if (!usedGifticonsError && usedGifticonsData) {
          usedGifticonsData.forEach(ug => {
            usedGifticonsMap.set(ug.id, { sale_price: ug.sale_price, status: ug.status });
          });
        }
      }

        if (gifticonsData) {
          const formattedGifticons: Gifticon[] = gifticonsData.map(g => {
            const usedGifticon = usedGifticonsMap.get(g.id);
            const formatted = {
              id: g.id,
              brand: g.brand,
              name: g.name,
              originalPrice: g.original_price,
              image: g.image,
              expiryDate: new Date(g.expiry_date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).replace(/\. /g, '.').replace(/\.$/, ''),
              status: g.status as "사용가능" | "사용완료" | "판매완료",
              isSelling: g.is_selling || false,
              barcode: (g as any).barcode || undefined,
              expiryDateRaw: g.expiry_date, // 원본 날짜 저장
              salePrice: usedGifticon?.sale_price,
              createdAt: g.created_at || undefined,
              updatedAt: g.updated_at || undefined
            };
            console.log(`기프티콘 ${g.id} 포맷팅:`, { status: formatted.status, isSelling: formatted.isSelling });
            return formatted;
          });
          
          // 가짜 기프티콘 데이터 추가 (테스트용)
          const today = new Date();
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + 30); // 30일 후
          const pastDate = new Date(today);
          pastDate.setDate(today.getDate() - 5); // 5일 전
          
          // 사용 가능 탭용 가짜 기프티콘 (보유중)
          const fakeAvailableGifticon: Gifticon = {
            id: 'fake-available-001',
            brand: '스타벅스',
            name: '아메리카노 Tall',
            originalPrice: 4500,
            image: '☕',
            expiryDate: futureDate.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, ''),
            status: '사용가능',
            isSelling: false,
            expiryDateRaw: futureDate.toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // 사용 가능 탭용 가짜 기프티콘 (판매중)
          const fakeSellingGifticon: Gifticon = {
            id: 'fake-selling-001',
            brand: '이디야',
            name: '카페라떼',
            originalPrice: 4000,
            image: '🥤',
            expiryDate: futureDate.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, ''),
            status: '사용가능',
            isSelling: true,
            salePrice: 3500,
            expiryDateRaw: futureDate.toISOString().split('T')[0],
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5일 전
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2일 전
          };
          
          // 완료/만료 탭용 가짜 기프티콘 (사용완료)
          const fakeCompletedGifticon: Gifticon = {
            id: 'fake-completed-001',
            brand: '투썸플레이스',
            name: '카페라떼',
            originalPrice: 5000,
            image: '🍰',
            expiryDate: pastDate.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, ''),
            status: '사용완료',
            isSelling: false,
            expiryDateRaw: pastDate.toISOString().split('T')[0],
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10일 전
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3일 전 (사용일)
          };
          
          // 완료/만료 탭용 가짜 기프티콘 (판매완료)
          const fakeSoldGifticon: Gifticon = {
            id: 'fake-sold-001',
            brand: '할리스',
            name: '바닐라라떼',
            originalPrice: 5500,
            image: '🍪',
            expiryDate: pastDate.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, ''),
            status: '판매완료',
            isSelling: false,
            salePrice: 4500,
            expiryDateRaw: pastDate.toISOString().split('T')[0],
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15일 전
            updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7일 전 (판매일)
          };
          
          formattedGifticons.push(fakeAvailableGifticon, fakeSellingGifticon, fakeCompletedGifticon, fakeSoldGifticon);
          
          console.log("포맷팅된 기프티콘 목록:", formattedGifticons);
          setGifticons(formattedGifticons);
        }
    } else {
      setIsLoggedIn(false);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadGifticons();
  }, []);

  const filteredGifticons = gifticons.filter((gifticon) => {
    if (filterStatus === "사용 가능") {
      // 사용 가능 탭에서는 사용가능 상태인 것만 필터링
      if (gifticon.status !== "사용가능") {
        console.log(`필터링 제외 (상태 불일치): ${gifticon.id}, 상태: ${gifticon.status}`);
        return false;
      }

      // 기한만료인 기프티콘은 사용 가능 탭에서 제외
      if (gifticon.expiryDateRaw) {
        const expiryDate = new Date(gifticon.expiryDateRaw);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        if (expiryDate < today) {
          console.log(`필터링 제외 (기한만료): ${gifticon.id}`);
          return false;
        }
      }

      // 서브 필터 적용 (전체 선택 시 모든 항목 표시)
      if (subFilter === "전체") {
        console.log(`필터링 통과: ${gifticon.id}, 상태: ${gifticon.status}, 판매중: ${gifticon.isSelling}`);
        return true;
      }
      if (subFilter === "보유중" && gifticon.isSelling) {
        return false;
      }
      if (subFilter === "판매중" && !gifticon.isSelling) {
        return false;
      }

      return true;
    } else if (filterStatus === "완료/만료") {
      // 완료/만료 탭 필터링
      if (subFilter === "전체") {
        // 전체 선택 시: 사용완료, 판매완료, 기한만료(만료일이 지난 사용가능 상태) 모두 표시
        if (gifticon.status === "사용완료" || gifticon.status === "판매완료") {
          return true;
        }
        // 기한만료 체크
        if (!gifticon.expiryDateRaw) return false;
        if (gifticon.status === "사용가능") {
          const expiryDate = new Date(gifticon.expiryDateRaw);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          expiryDate.setHours(0, 0, 0, 0);
          return expiryDate < today;
        }
        return false;
      }

      if (subFilter === "사용완료" && gifticon.status !== "사용완료") {
        return false;
      }
      if (subFilter === "판매완료" && gifticon.status !== "판매완료") {
        return false;
      }
      if (subFilter === "기한만료") {
        // 기한만료: 만료일이 지났고 상태가 "사용가능"인 것만
        if (!gifticon.expiryDateRaw) return false;
        // 상태가 사용완료나 판매완료면 기한만료로 표시하지 않음
        if (gifticon.status === "사용완료" || gifticon.status === "판매완료") {
          return false;
        }
        const expiryDate = new Date(gifticon.expiryDateRaw);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate < today;
      }

      return true;
    }

    return true;
  });

  // 정렬 적용
  const sortedGifticons = [...filteredGifticons].sort((a, b) => {
    switch (sortOrder) {
      case "유효기간임박순": {
        // 유효기간이 임박한 순 (오름차순)
        if (!a.expiryDateRaw || !b.expiryDateRaw) {
          if (!a.expiryDateRaw && !b.expiryDateRaw) return 0;
          return !a.expiryDateRaw ? 1 : -1;
        }
        const dateA = new Date(a.expiryDateRaw).getTime();
        const dateB = new Date(b.expiryDateRaw).getTime();
        return dateA - dateB;
      }
      case "구매일순": {
        // 최근 구매일 순 (내림차순)
        if (!a.createdAt || !b.createdAt) {
          if (!a.createdAt && !b.createdAt) return 0;
          return !a.createdAt ? 1 : -1;
        }
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      }
      case "낮은가격순": {
        // 가격 오름차순
        return a.originalPrice - b.originalPrice;
      }
      case "높은가격순": {
        // 가격 내림차순
        return b.originalPrice - a.originalPrice;
      }
      case "사용일순": {
        // 최근 사용일 순 (내림차순) - updated_at 사용, 없으면 createdAt 사용
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      }
      default:
        return 0;
    }
  });

  const handleSellClick = (gifticon: Gifticon) => {
    // 판매완료 상태는 판매 불가
    if (gifticon.status === "판매완료") {
      toast({
        title: "판매 불가",
        description: "판매완료된 기프티콘은 더 이상 판매할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }
    
    // 사용가능 상태만 판매 가능
    if (gifticon.status !== "사용가능") {
      toast({
        title: "판매 불가",
        description: "사용가능 상태의 기프티콘만 판매할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }
    
    setSellingGifticon(gifticon);
    setSalePrice(gifticon.salePrice?.toString() || "");
    setIsSellDialogOpen(true);
  };

  const handleSellConfirm = async () => {
    if (!sellingGifticon || !isLoggedIn) return;
    
    const price = parseInt(salePrice.replace(/,/g, ''));
    
    // 유효성 검사
    if (isNaN(price) || price <= 0) {
      toast({
        title: "가격 오류",
        description: "올바른 가격을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (price > sellingGifticon.originalPrice) {
      toast({
        title: "가격 오류",
        description: "판매 가격은 원가보다 높을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // used_gifticons에 레코드 생성 (id를 gifticons.id로 명시 지정)
      const { error: insertError } = await supabase
        .from('used_gifticons')
        .insert({
          id: sellingGifticon.id, // gifticons.id와 동일한 값으로 지정
          seller_id: session.user.id,
          available_at: sellingGifticon.brand,
          name: sellingGifticon.name,
          barcode: sellingGifticon.barcode || '',
          original_price: sellingGifticon.originalPrice,
          sale_price: price,
          expiry_date: sellingGifticon.expiryDateRaw || new Date().toISOString().split('T')[0],
          status: '판매중'
        });

      if (insertError) {
        // 이미 존재하는 경우 업데이트
        if (insertError.code === '23505') { // unique violation
          const { error: updateError } = await supabase
            .from('used_gifticons')
            .update({
              sale_price: price,
              status: '판매중'
            })
            .eq('id', sellingGifticon.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          throw insertError;
        }
      }

      // gifticons.is_selling = true로 업데이트
      const { error: updateGifticonError } = await supabase
        .from('gifticons')
        .update({ is_selling: true })
        .eq('id', sellingGifticon.id);

      if (updateGifticonError) {
        throw updateGifticonError;
      }

      // 로컬 상태 업데이트
      setGifticons(prev => prev.map(g =>
        g.id === sellingGifticon.id 
          ? { ...g, isSelling: true, salePrice: price } 
          : g
      ));

      toast({
        title: "판매 등록 완료",
        description: "기프티콘이 판매중 상태로 등록되었습니다.",
      });

      setIsSellDialogOpen(false);
      setSellingGifticon(null);
      setSalePrice("");
    } catch (error: any) {
      console.error("판매 등록 오류:", error);
      toast({
        title: "판매 등록 실패",
        description: error.message || "판매 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCancelSelling = async (id: string) => {
    if (!isLoggedIn) return;

    try {
      // used_gifticons 레코드 삭제
      const { error: deleteError } = await supabase
        .from('used_gifticons')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // gifticons.is_selling = false로 업데이트
      const { error: updateError } = await supabase
        .from('gifticons')
        .update({ is_selling: false })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      // 로컬 상태 업데이트
      setGifticons(prev => prev.map(g =>
        g.id === id ? { ...g, isSelling: false, salePrice: undefined } : g
      ));

      toast({
        title: "판매 취소 완료",
        description: "판매가 취소되었습니다.",
      });
    } catch (error: any) {
      console.error("판매 취소 오류:", error);
      toast({
        title: "판매 취소 실패",
        description: error.message || "판매 취소 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleRestoreClick = (gifticon: Gifticon) => {
    setRestoreTargetGifticon(gifticon);
    setRestoreDialogOpen(true);
  };

  const restoreGifticon = async () => {
    if (!isLoggedIn || !restoreTargetGifticon) return;

    console.log("복구 시도:", restoreTargetGifticon.id, "현재 상태:", restoreTargetGifticon.status);

    const { data, error } = await supabase
      .from('gifticons')
      .update({ 
        status: '사용가능',
        is_selling: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', restoreTargetGifticon.id)
      .select();

    console.log("복구 결과:", { data, error });

    if (!error) {
      // 서버에서 최신 데이터 다시 불러오기
      await loadGifticons();
      
      // 복구 후 사용 가능 탭으로 전환
      setFilterStatus("사용 가능");
      setSubFilter("전체");
      setRestoreDialogOpen(false);
      setRestoreTargetGifticon(null);
      toast({
        title: "복구 완료",
        description: "기프티콘이 사용가능 상태로 변경되었습니다.",
      });
    } else {
      console.error("복구 오류:", error);
      toast({
        title: "복구 실패",
        description: error.message || "기프티콘 복구 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const isExpired = (gifticon: Gifticon) => {
    if (!gifticon.expiryDateRaw) return false;
    const expiryDate = new Date(gifticon.expiryDateRaw);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    return expiryDate < today;
  };

  const handleGifticonClick = (gifticon: Gifticon) => {
    // 판매완료 상태는 바코드 보기 불가
    if (gifticon.status === "판매완료") {
      toast({
        title: "접근 불가",
        description: "판매완료된 기프티콘은 더 이상 확인할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!gifticon.barcode) {
      toast({
        title: "바코드 없음",
        description: "이 기프티콘에는 바코드가 없습니다.",
        variant: "destructive",
      });
      return;
    }
    setSelectedGifticon(gifticon);
    setIsBarcodeDialogOpen(true);
  };

  const handleCloseBarcode = () => {
    setIsBarcodeDialogOpen(false);
    setSelectedGifticon(null);
  };

  const BarcodeDisplay = ({ number }: { number: string }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      if (svgRef.current && number) {
        try {
          // 숫자만 추출 (문자열이 있을 수 있음)
          const barcodeNumber = number.replace(/\D/g, '');
          
          if (barcodeNumber.length === 0) {
            return;
          }

          // EAN-13 형식인지 확인 (13자리)
          if (barcodeNumber.length === 13) {
            try {
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "EAN13",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            } catch (ean13Error) {
              // EAN-13 체크섬 오류 시 CODE128로 대체
              console.warn("EAN13 체크섬 오류, CODE128로 변경:", ean13Error);
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "CODE128",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            }
          } else if (barcodeNumber.length === 8) {
            // EAN-8 형식 (8자리)
            try {
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "EAN8",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            } catch (ean8Error) {
              // EAN-8 체크섬 오류 시 CODE128로 대체
              console.warn("EAN8 체크섬 오류, CODE128로 변경:", ean8Error);
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "CODE128",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            }
          } else {
            // CODE128 형식 (다양한 길이 지원)
            JsBarcode(svgRef.current, barcodeNumber, {
              format: "CODE128",
              width: 2,
              height: 80,
              displayValue: false,
              background: "transparent",
              lineColor: "#000000",
              margin: 0,
            });
          }
        } catch (error) {
          console.error("바코드 생성 오류:", error);
        }
      }
    }, [number]);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-center bg-white p-3 rounded-lg">
          <svg
            ref={svgRef}
            className="max-w-full h-20"
            style={{ maxHeight: '80px' }}
          />
        </div>
        <p className="text-center font-mono text-xs tracking-widest">{number}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  // 바코드 화면 표시
  if (isBarcodeDialogOpen && selectedGifticon) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with Back Button */}
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="max-w-md mx-auto py-4 px-4 relative">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleCloseBarcode}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Barcode Card */}
        <main className="max-w-md mx-auto px-4 py-6">
          <Card className="p-4 rounded-2xl border-border/50">
            <div className="space-y-3">
              <BarcodeDisplay number={selectedGifticon.barcode || ""} />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">기프티콘</p>
                  <p className="font-bold text-sm">{selectedGifticon.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedGifticon.originalPrice.toLocaleString()}원
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      {/* Filter Tabs */}
      <div className="max-w-md mx-auto px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button
            variant={filterStatus === "사용 가능" ? "default" : "outline"}
            className="flex-1 min-w-[80px]"
            onClick={() => handleFilterStatusChange("사용 가능")}
          >
            사용 가능
          </Button>
          <Button
            variant={filterStatus === "완료/만료" ? "default" : "outline"}
            className="flex-1 min-w-[80px]"
            onClick={() => handleFilterStatusChange("완료/만료")}
          >
            완료/만료
          </Button>
        </div>
      </div>

      {/* Sub Filter Chips */}
      <div className="max-w-md mx-auto px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {filterStatus === "사용 가능" && (
            <>
              <Badge
                variant={subFilter === "전체" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("전체")}
              >
                전체
              </Badge>
              <Badge
                variant={subFilter === "보유중" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("보유중")}
              >
                보유중
              </Badge>
              <Badge
                variant={subFilter === "판매중" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("판매중")}
              >
                판매중
              </Badge>
            </>
          )}
          {filterStatus === "완료/만료" && (
            <>
              <Badge
                variant={subFilter === "전체" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("전체")}
              >
                전체
              </Badge>
              <Badge
                variant={subFilter === "사용완료" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("사용완료")}
              >
                사용완료
              </Badge>
              <Badge
                variant={subFilter === "판매완료" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("판매완료")}
              >
                판매완료
              </Badge>
              <Badge
                variant={subFilter === "기한만료" ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
                onClick={() => setSubFilter("기한만료")}
              >
                기한만료
              </Badge>
            </>
          )}
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
              <ArrowUpDown className="w-4 h-4" />
              <span className="text-sm">{sortOrder}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {filterStatus === "사용 가능" ? (
              <>
                <DropdownMenuItem onClick={() => setSortOrder("유효기간임박순")}>
                  유효기간임박순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("구매일순")}>
                  구매일 순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("낮은가격순")}>
                  낮은가격순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("높은가격순")}>
                  높은가격순
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setSortOrder("사용일순")}>
                  사용일 순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("구매일순")}>
                  구매일 순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("낮은가격순")}>
                  낮은가격순
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("높은가격순")}>
                  높은가격순
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Gifticons Grid */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          {sortedGifticons.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              {isLoggedIn ? "기프티콘이 없습니다" : "기프티콘이 없습니다"}
            </div>
          ) : (
            sortedGifticons.map((gifticon) => (
              <Card
                key={gifticon.id}
                className="overflow-hidden hover:shadow-lg transition-shadow w-full cursor-pointer"
                onClick={() => handleGifticonClick(gifticon)}
              >
                <div className="aspect-square bg-card flex items-center justify-center p-4 border-b border-border relative overflow-hidden">
                  <div className="text-7xl">{gifticon.image}</div>
                  {/* 완료/만료 탭에서만 이미지 위에 상태 표시 */}
                  {filterStatus === "완료/만료" && (
                    <>
                      {gifticon.status === "사용완료" && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="secondary" className="text-sm whitespace-nowrap">
                            사용완료
                          </Badge>
                        </div>
                      )}
                      {gifticon.status === "판매완료" && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="outline" className="text-sm whitespace-nowrap">
                            판매완료
                          </Badge>
                        </div>
                      )}
                      {gifticon.expiryDateRaw && (() => {
                        // 기한만료는 만료일이 지났고 상태가 사용가능인 것만 표시
                        if (gifticon.status === "사용완료" || gifticon.status === "판매완료") {
                          return null;
                        }
                        const expiryDate = new Date(gifticon.expiryDateRaw);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        expiryDate.setHours(0, 0, 0, 0);
                        return expiryDate < today ? (
                          <div className="absolute inset-0 bg-destructive/60 flex items-center justify-center">
                            <Badge variant="destructive" className="text-sm whitespace-nowrap">
                              기한만료
                            </Badge>
                          </div>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm text-muted-foreground truncate">{gifticon.brand}</p>
                  <p className="text-sm font-medium line-clamp-2">
                    {gifticon.name}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {gifticon.originalPrice.toLocaleString()}
                    <span className="text-sm font-normal">원</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~{gifticon.expiryDate}
                  </p>
                  {filterStatus === "사용 가능" && gifticon.status === "사용가능" && (
                    <Button
                      variant={gifticon.isSelling ? "outline" : "default"}
                      size="sm"
                      className={`w-full mt-2 ${gifticon.isSelling ? "text-primary border-primary hover:bg-primary/10" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (gifticon.isSelling) {
                          handleCancelSelling(gifticon.id);
                        } else {
                          handleSellClick(gifticon);
                        }
                      }}
                      disabled={!isLoggedIn || gifticon.status === "판매완료"}
                    >
                      {gifticon.isSelling ? "판매중" : "판매하기"}
                    </Button>
                  )}
                  {filterStatus === "완료/만료" && (
                    <>
                      {gifticon.status === "판매완료" ? (
                        <div className="text-xs text-muted-foreground text-center mt-2">
                          판매 완료된 기프티콘입니다
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreClick(gifticon);
                          }}
                          disabled={!isLoggedIn || gifticon.status === "판매완료"}
                        >
                          복구
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Add Gifticon Floating Button */}
      <Link to="/sell">
        <Button
          size="icon"
          className="fixed bottom-40 right-6 h-14 w-14 rounded-full shadow-lg z-40 bg-background border-2 border-primary hover:bg-primary/10"
        >
          <Plus className="h-6 w-6 text-primary" />
        </Button>
      </Link>

      {/* 판매 가격 입력 모달 */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>판매 가격 설정</DialogTitle>
            <DialogDescription>
              판매할 가격을 입력해주세요. (최대 {sellingGifticon?.originalPrice.toLocaleString()}원)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="salePrice">판매 가격 (원)</Label>
              <Input
                id="salePrice"
                type="text"
                placeholder="예: 8000"
                value={salePrice}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setSalePrice(value);
                }}
                onBlur={(e) => {
                  const numValue = parseInt(e.target.value.replace(/,/g, ''));
                  if (!isNaN(numValue)) {
                    setSalePrice(numValue.toLocaleString());
                  }
                }}
              />
              {sellingGifticon && (
                <div className="text-sm text-muted-foreground">
                  원가: {sellingGifticon.originalPrice.toLocaleString()}원
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSellDialogOpen(false);
                setSellingGifticon(null);
                setSalePrice("");
              }}
            >
              취소
            </Button>
            <Button onClick={handleSellConfirm}>
              판매 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 복구 확인 모달 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>복구 확인</DialogTitle>
            <DialogDescription>
              {restoreTargetGifticon && (() => {
                if (restoreTargetGifticon.status === "사용완료") {
                  return (
                    <span>
                      이 기프티콘은 <span className="font-bold">사용완료</span>된 기프티콘입니다. 복구 하시겠습니까?
                    </span>
                  );
                } else if (isExpired(restoreTargetGifticon)) {
                  return (
                    <span>
                      이 기프티콘은 <span className="font-bold text-destructive">만료</span>된 기프티콘입니다. 정말로 복구하시겠습니까?
                    </span>
                  );
                } else {
                  return "정말로 복구하시겠습니까?";
                }
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRestoreDialogOpen(false);
                setRestoreTargetGifticon(null);
              }}
            >
              취소
            </Button>
            <Button onClick={restoreGifticon}>
              복구
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default MyGifticons;
