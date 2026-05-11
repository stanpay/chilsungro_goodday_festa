import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, Calendar as CalendarIcon, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isToday, isYesterday, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";

interface Payment {
  id: string;
  store: string;
  date: string;
  time: string;
  amount: number;
  method: string;
  status: string;
}

const History = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkUserAndLoadHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsLoggedIn(true);
        
        // Load user's payment history from database
        const { data, error } = await supabase
          .from('payment_history')
          .select('*')
          .eq('user_id', session.user.id)
          .order('date', { ascending: false })
          .order('time', { ascending: false });

        if (data && !error) {
          const formattedPayments: Payment[] = data.map(p => ({
            id: p.id,
            store: p.store,
            date: format(new Date(p.date), 'yyyy.MM.dd'),
            time: format(new Date(`2000-01-01 ${p.time}`), 'HH:mm'),
            amount: p.amount,
            method: p.method,
            status: p.status
          }));
          setPayments(formattedPayments);
        }
      } else {
        setIsLoggedIn(false);
      }
      
      setLoading(false);
    };

    checkUserAndLoadHistory();
  }, []);

  // 검색 및 날짜 필터링
  const filteredPayments = payments.filter((payment) => {
    // 매장명 검색
    const matchesSearch = payment.store.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 날짜 범위 필터링
    if (dateRange.from) {
      const paymentDate = parse(payment.date, "yyyy.MM.dd", new Date());
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        return matchesSearch && paymentDate >= fromDate && paymentDate <= toDate;
      } else {
        return matchesSearch && paymentDate.toDateString() === fromDate.toDateString();
      }
    }
    
    return matchesSearch;
  });

  // 날짜별로 그룹화
  const groupedPayments = filteredPayments.reduce((groups, payment) => {
    const date = payment.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(payment);
    return groups;
  }, {} as Record<string, typeof payments>);

  // 날짜를 "오늘", "어제" 또는 날짜 형식으로 표시
  const formatDateLabel = (dateStr: string) => {
    const date = parse(dateStr, "yyyy.MM.dd", new Date());
    if (isToday(date)) return "오늘";
    if (isYesterday(date)) return "어제";
    return dateStr;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/mypage">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">결제 내역</h1>
        </div>
      </header>

      {/* Search and Filter Bar */}
      <div className="max-w-md mx-auto px-4 py-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="매장 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "M월 d일", { locale: ko })} ~{" "}
                      {format(dateRange.to, "M월 d일", { locale: ko })}
                    </>
                  ) : (
                    format(dateRange.from, "M월 d일", { locale: ko })
                  )
                ) : (
                  <span>날짜 선택</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={
                  dateRange.from && dateRange.to
                    ? { from: dateRange.from, to: dateRange.to }
                    : dateRange.from
                    ? { from: dateRange.from, to: dateRange.from }
                    : undefined
                }
                onSelect={(range) =>
                  setDateRange({ from: range?.from, to: range?.to })
                }
                disabled={(date) => date > new Date()}
                locale={ko}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {(dateRange.from || searchQuery) && (
            <Button
              variant="ghost"
              onClick={() => {
                setDateRange({});
                setSearchQuery("");
              }}
            >
              초기화
            </Button>
          )}
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-6">
          {Object.keys(groupedPayments).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isLoggedIn ? "결제 내역이 없습니다" : "결제 내역이 없습니다"}
            </div>
          ) : (
            Object.entries(groupedPayments).map(([date, datePayments]) => (
              <div key={date}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                  {formatDateLabel(date)}
                </h2>
                <div className="space-y-3">
                  {datePayments.map((payment) => (
                    <Card
                      key={payment.id}
                      className="p-4 rounded-xl border-border/50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-1">
                            {payment.store}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {payment.time}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {payment.method}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-bold text-lg mb-2">
                            {payment.amount.toLocaleString()}원
                          </p>
                          <Badge
                            variant={
                              payment.status === "완료" ? "default" : "secondary"
                            }
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default History;
