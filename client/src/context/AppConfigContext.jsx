import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import api from "../api";

// Varsayılanları burada merkezi tutuyoruz.
// Böylece site_config DB’de eksik olsa bile sistem stabil kalır.
const DEFAULT_SITE_CONFIG = {
  title: "Mesleki Uygulama Takip Sistemi",
  slogan: "Şeffaf • İzlenebilir • Ölçülebilir",
  homeImageUrl: "",
  themePreset: "blue",
  menuPreset: "dark", // ✅ default dark
};

const AppConfigContext = createContext(null);

function normalizeSiteConfig(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    ...DEFAULT_SITE_CONFIG,
    ...r,
    // güvenlik: beklenmeyen tipleri toparla
    title: String(r.title ?? DEFAULT_SITE_CONFIG.title),
    slogan: String(r.slogan ?? DEFAULT_SITE_CONFIG.slogan),
    homeImageUrl: String(r.homeImageUrl ?? DEFAULT_SITE_CONFIG.homeImageUrl),
    themePreset: String(r.themePreset ?? DEFAULT_SITE_CONFIG.themePreset),
    menuPreset: String(r.menuPreset ?? DEFAULT_SITE_CONFIG.menuPreset),
  };
}

export function AppConfigProvider({ children }) {
  const [siteConfig, setSiteConfig] = useState(DEFAULT_SITE_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // İlk render’da sadece 1 kez yüklemek için
  const didInitRef = useRef(false);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      // cache-buster: bazı ortamlarda GET cache olabiliyor
      const { data } = await api.get("/settings", {
        params: { _ts: Date.now() },
      });

      const normalized = normalizeSiteConfig(data?.site_config);
      setSiteConfig({ ...normalized });
    } catch (e) {
      // hata olursa default config ile devam
      setSiteConfig({ ...DEFAULT_SITE_CONFIG });
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    loadConfig();
  }, [loadConfig]);

  const value = useMemo(
    () => ({
      siteConfig,
      loadingConfig,
      reloadConfig: loadConfig,
      DEFAULT_SITE_CONFIG,
    }),
    [siteConfig, loadingConfig, loadConfig]
  );

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within AppConfigProvider");
  return ctx;
}