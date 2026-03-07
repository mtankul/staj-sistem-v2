import React, { useEffect, useMemo, useState } from "react";
import { Layout, Menu, Typography } from "antd";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  CalendarOutlined,
  UserOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
} from "@ant-design/icons";

import api from "../api";
import { clearAuth } from "../utils/authStorage";

const { Header, Sider, Content } = Layout;

export default function TeacherShell() {
  const nav = useNavigate();
  const loc = useLocation();
  const selectedKeys = [loc.pathname];

  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/teacher/me");
        setMe(data?.user ?? data);
      } catch {
        clearAuth();
        nav("/login", { replace: true });
      }
    })();
  }, [nav]);

  const roleText = me
    ? me.isCoordinator && me.isObserver
      ? "Koordinatör + Gözlemci"
      : me.isCoordinator
      ? "Koordinatör"
      : "Gözlemci"
    : "—";

  const items = useMemo(() => {
    const base = [
      { key: "/teacher", icon: <UserOutlined />, label: "Panel" },
      {
        key: "/teacher/scoring",
        icon: <CalendarOutlined />,
        label: "Devamsızlık & Notlar",
      },
    ];

    if (me?.isCoordinator) {
      base.push(
        {
          key: "/teacher/control-panel",
          icon: <DashboardOutlined />,
          label: "Koordinatör Kontrol Paneli",
        },
        {
          key: "/teacher/eval-control",
          icon: <CheckSquareOutlined />,
          label: "Değerlendirme Kontrol Paneli",
        },
        {
          key: "/teacher/report-scoring",
          icon: <FileTextOutlined />,
          label: "Rapor Puanlama",
        }
      );
    }

    return base;
  }, [me?.isCoordinator]);

  const doLogout = () => {
    clearAuth();
    nav("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={240} theme="dark">
        <div style={{ padding: 16, fontWeight: 800, color: "#fff" }}>
          Gözlemci Paneli
          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            TDS · Mesleki Uygulama
          </div>
        </div>

        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 8,
          }}
        >
          <img
            src={me?.photoUrl || "/logo/user.png"}
            alt="pp"
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid rgba(255,255,255,0.25)",
              marginBottom: 12,
            }}
          />

          <div
            style={{
              fontWeight: 700,
              color: "#fff",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {me?.nameSurname || "—"}
          </div>

          <div style={{ fontSize: 12, opacity: 0.75, color: "#fff", marginTop: 4 }}>
            {roleText}
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={selectedKeys}
          onClick={(e) => nav(e.key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            borderBottom: "1px solid rgba(0,0,0,.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingInline: 16,
          }}
        >
          <Typography.Text style={{ fontWeight: 700 }}>
            {roleText}
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
          <Outlet context={{ me }} />
        </Content>
      </Layout>
    </Layout>
  );
}