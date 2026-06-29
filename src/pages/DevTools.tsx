import { useState } from "react";
import { promptNaverMapFallback } from "@/lib/mapDirectionFallback";

const getStorageEntries = (storage: Storage) => {
  const entries: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) entries[key] = storage.getItem(key) ?? "";
  }
  return entries;
};

const StoragePanel = ({
  label,
  storage,
}: {
  label: string;
  storage: Storage;
}) => {
  const [entries, setEntries] = useState(() => getStorageEntries(storage));
  const [cleared, setCleared] = useState(false);

  const refresh = () => {
    setEntries(getStorageEntries(storage));
    setCleared(false);
  };

  const handleClear = () => {
    storage.clear();
    setEntries({});
    setCleared(true);
  };

  const handleRemove = (key: string) => {
    storage.removeItem(key);
    setEntries((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const keys = Object.keys(entries);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{label}</h2>
        <span style={{ fontSize: 13, color: "#666" }}>{keys.length}개 항목</span>
        <button onClick={refresh} style={btnStyle("#555")}>새로고침</button>
        <button onClick={handleClear} style={btnStyle("#c0392b")}>전체 삭제</button>
      </div>
      {cleared && (
        <p style={{ color: "#c0392b", fontSize: 13, margin: "4px 0 8px" }}>✅ 삭제 완료</p>
      )}
      {keys.length === 0 ? (
        <p style={{ color: "#999", fontSize: 13 }}>비어 있음</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th style={thStyle}>키</th>
              <th style={thStyle}>값</th>
              <th style={{ ...thStyle, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap" }}>{key}</td>
                <td style={{ ...tdStyle, wordBreak: "break-all", maxWidth: 400, color: "#444" }}>
                  {entries[key].length > 200
                    ? entries[key].slice(0, 200) + "…"
                    : entries[key]}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => handleRemove(key)} style={btnStyle("#c0392b", true)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const btnStyle = (bg: string, small = false): React.CSSProperties => ({
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: small ? "2px 8px" : "5px 12px",
  fontSize: small ? 11 : 13,
  cursor: "pointer",
  fontWeight: 600,
});

const thStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: "5px 10px",
  verticalAlign: "top",
};

const DevTools = () => {
  const openNaverMapFallbackPreview = () => {
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/i.test(ua) ? "ios" : "android";
    promptNaverMapFallback({
      platform,
      webFallbackUrl: "https://map.naver.com/",
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Dev Tools</h1>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 32 }}>
        이 페이지는 URL을 아는 사람만 접근할 수 있습니다.
      </p>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>UI 미리보기</h2>
        <button
          type="button"
          onClick={openNaverMapFallbackPreview}
          style={btnStyle("#2563eb")}
        >
          네이버 지도 fallback 팝업 열기
        </button>
      </div>
      <StoragePanel label="localStorage" storage={localStorage} />
      <StoragePanel label="sessionStorage" storage={sessionStorage} />
    </div>
  );
};

export default DevTools;
