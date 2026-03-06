import { Layout, Menu, Typography, Grid } from "antd";
import {
  TeamOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  DashboardOutlined,
  CalendarOutlined,
  BankOutlined,
  BookOutlined,
  SettingOutlined,
  IdcardOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  SwapOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

import api from "../api";
import { useAppConfig } from "../context/AppConfigContext";
import { clearAuth } from "../utils/authStorage";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export default function AdminShell() {
  const { siteConfig } = useAppConfig();

  const menuPreset = siteConfig?.menuPreset || "light";
  const menuTheme = menuPreset === "dark" ? "dark" : "light";
  const isMenuDark = menuTheme === "dark";
  const shellBg = isMenuDark ? "#0b1220" : "#f5f5f5";

  const screens = useBreakpoint();
  const [collapsed, setCollapsed] = useState(!screens.lg);

  const nav = useNavigate();
  const loc = useLocation();
  const selectedKeys = [loc.pathname];

  useEffect(() => setCollapsed(!screens.lg), [screens.lg]);

  // ✅ common data (pages/Teachers vb. bunu kullanıyor)
  const [periods, setPeriods] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [periodId, setPeriodId] = useState(null);

  const loadCommon = useCallback(async () => {
    const [pRes, hRes] = await Promise.all([api.get("/periods"), api.get("/hospitals")]);
    const pList = pRes.data || [];
    const hList = hRes.data || [];

    setPeriods(pList);
    setHospitals(hList);
    setPeriodId((prev) => prev ?? (pList.length ? pList[0].id : null));
  }, []);

  useEffect(() => {
    loadCommon();
  }, [loadCommon]);

  const doLogout = () => {
    clearAuth();
    nav("/login", { replace: true });
  };

  // accordion states
  const isInDefinitions =
    loc.pathname.startsWith("/admin/courses") ||
    loc.pathname.startsWith("/admin/periods") ||
    loc.pathname.startsWith("/admin/hospitals") ||
    loc.pathname.startsWith("/admin/students") ||
    loc.pathname.startsWith("/admin/units") ||
    loc.pathname.startsWith("/admin/teachers");

  const isInObserverEvals =
    loc.pathname.startsWith("/admin/evaluation") ||
    loc.pathname.startsWith("/admin/eval-templates");

  const isInStudentReports =
    loc.pathname.startsWith("/admin/report-setup") ||
    loc.pathname.startsWith("/admin/report-templates") ||
    loc.pathname.startsWith("/admin/report-scoring");

  const isInRotations =
    loc.pathname.startsWith("/admin/assignments") ||
    loc.pathname.startsWith("/admin/lottery");

  const rootSubmenuKeys = ["definitions", "observerEvals", "studentReports", "rotations"];

  const initialOpenKeys = () => {
    if (isInDefinitions) return ["definitions"];
    if (isInObserverEvals) return ["observerEvals"];
    if (isInStudentReports) return ["studentReports"];
    if (isInRotations) return ["rotations"];
    return [];
  };

  const [openKeys, setOpenKeys] = useState(() => initialOpenKeys());

  useEffect(() => {
    if (collapsed) return;
    setOpenKeys(initialOpenKeys());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, collapsed]);

  const onOpenChange = (keys) => {
    const latestOpenKey = keys.find((k) => !openKeys.includes(k));
    if (latestOpenKey && rootSubmenuKeys.includes(latestOpenKey)) setOpenKeys([latestOpenKey]);
    else setOpenKeys(keys);
  };

  const items = useMemo(
    () => [
      { key: "/admin", icon: <DashboardOutlined />, label: "Dashboard" },

      {
        key: "definitions",
        icon: <AppstoreOutlined />,
        label: "Tanımlamalar",
        children: [
          { key: "/admin/courses", icon: <BookOutlined />, label: "Dersler (MU I/II)" },
          { key: "/admin/periods", icon: <CalendarOutlined />, label: "Dönemler" },
          { key: "/admin/hospitals", icon: <BankOutlined />, label: "Hastaneler" },
          { key: "/admin/students", icon: <TeamOutlined />, label: "Öğrenciler" },
          { key: "/admin/units", icon: <ApartmentOutlined />, label: "Birimler" },
          { key: "/admin/teachers", icon: <IdcardOutlined />, label: "Gözlemciler" },
        ],
      },

      {
        key: "observerEvals",
        icon: <CheckSquareOutlined />,
        label: "Gözetmen Değerlendirmeleri",
        children: [
          { key: "/admin/evaluation", icon: <CheckSquareOutlined />, label: "Değerlendirme Tanımı" },
          { key: "/admin/eval-templates", icon: <FileTextOutlined />, label: "Değerlendirme Şablonları" },
        ],
      },

      {
        key: "studentReports",
        icon: <FileTextOutlined />,
        label: "Öğrenci Staj Raporları",
        children: [
          { key: "/admin/report-setup", icon: <FileTextOutlined />, label: "Rapor Tanımı" },
          { key: "/admin/report-templates", icon: <FileTextOutlined />, label: "Rapor Şablonları" },
          { key: "/admin/report-scoring", icon: <DashboardOutlined />, label: "Rapor Puanlama" },
        ],
      },

      {
        key: "rotations",
        icon: <SwapOutlined />,
        label: "Rotasyonlar",
        children: [
          { key: "/admin/assignments", icon: <CalendarOutlined />, label: "Atamalar" },
          { key: "/admin/lottery", icon: <ThunderboltOutlined />, label: "Kuralar" },
        ],
      },

      { key: "/admin/scoring", icon: <DashboardOutlined />, label: "Notlar & Devamsızlık" },
      { key: "/admin/settings", icon: <SettingOutlined />, label: "Sistem Ayarları" },
    ],
    []
  );

  return (
    <div className={`admin-shell menu-${menuPreset}`}>
      <Layout style={{ minHeight: "100vh", background: shellBg }}>
        <Sider
          width={285}
          theme={menuTheme}
          breakpoint="lg"
          collapsedWidth={screens.lg ? 80 : 0}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
        >
          <div
            className="admin-brand"
            style={{
              background: isMenuDark ? "#001529" : "#ffffff",
              color: isMenuDark ? "#fff" : "#111",
              borderBottom: isMenuDark ? "1px solid rgba(255,255,255,.10)" : "1px solid rgba(0,0,0,.06)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "16px 12px",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>MUYS</div>
            <div
              style={{
                fontWeight: 500,
                fontSize: 12,
                marginTop: 4,
                color: isMenuDark ? "rgba(255,255,255,.72)" : "rgba(0,0,0,.55)",
              }}
            >
              Kurumsal Yönetim Paneli
            </div>
          </div>

          <Menu
            theme={menuTheme}
            mode="inline"
            items={items}
            selectedKeys={selectedKeys}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={onOpenChange}
            onClick={(e) => {
              if (typeof e.key === "string" && e.key.startsWith("/")) nav(e.key);
            }}
          />
        </Sider>

        <Layout>
          <Header
            style={{
              background: isMenuDark ? "#0b1220" : "#ffffff",
              borderBottom: isMenuDark ? "1px solid rgba(255,255,255,.10)" : "1px solid rgba(0,0,0,.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingInline: 16,
            }}
          >
            <Typography.Text style={{ color: isMenuDark ? "#fff" : "#111" }}>
              {siteConfig?.siteTitle || "Mesleki Uygulama Yönetim Sistemi"}
            </Typography.Text>

            <a
              href="#"
              onClick={(ev) => {
                ev.preventDefault();
                doLogout();
              }}
            >
              Çıkış
            </a>
          </Header>

          <Content style={{ padding: 16 }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
              <Outlet context={{ periods, hospitals, periodId, setPeriodId, reloadCommon: loadCommon }} />
            </div>
          </Content>
        </Layout>
      </Layout>
    </div>
  );
}