//\client\src\shells/StudentShell.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Layout, Menu, Typography, Modal, Input, message, Tag } from "antd";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { UserOutlined, FileTextOutlined } from "@ant-design/icons";
import api from "../api";
import { clearAuth } from "../utils/authStorage";

const { Header, Sider, Content } = Layout;

export default function StudentShell() {
  const nav = useNavigate();
  const loc = useLocation();
  const selectedKeys = useMemo(() => [loc.pathname], [loc.pathname]);

  const [me, setMe] = useState(null);

  // pin change modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);

  const doLogout = () => {
    clearAuth();
    nav("/login", { replace: true });
  };

  async function loadMe() {
    const { data } = await api.get("/student/me");
    setMe(data);
    setPinModalOpen(!!data?.mustChangePin);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadMe();
      } catch {
        doLogout();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePin() {
    try {
      setSaving(true);
      await api.post("/student/pin/change", { currentPin, newPin });
      message.success("PIN güncellendi");
      setPinModalOpen(false);
      setCurrentPin("");
      setNewPin("");
      await loadMe();
    } catch (e) {
      message.error(e?.response?.data?.error || "PIN güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  // Menü
  const items = [
    { key: "/student", icon: <UserOutlined />, label: "Hoş geldin" },
    { key: "/student/report", icon: <FileTextOutlined />, label: "Haftalık Raporlar" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={240} theme="dark">
        <div style={{ padding: 16, fontWeight: 800, color: "#fff" }}>
          Öğrenci Paneli
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 500, marginTop: 4 }}>TDS · Mesleki Uygulama</div>
        </div>

        {/* Profil */}
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
            title={me?.nameSurname || ""}
          >
            {me?.nameSurname || "—"}
          </div>

          <div style={{ fontSize: 12, opacity: 0.75, color: "#fff", marginTop: 4 }}>
            Öğrenci {me?.studentNo ? `· ${me.studentNo}` : ""}
          </div>

          {me?.period?.courseName ? (
            <div style={{ marginTop: 10 }}>
              <Tag color="blue">{me.period.courseName}</Tag>
            </div>
          ) : null}
        </div>

        <Menu theme="dark" mode="inline" items={items} selectedKeys={selectedKeys} onClick={(e) => nav(e.key)} />
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Typography.Text style={{ fontWeight: 700 }}>Öğrenci</Typography.Text>

            {me?.mustChangePin ? (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                İlk giriş: PIN değiştirmeniz gerekiyor
              </Typography.Text>
            ) : null}
          </div>

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
          {/* ✅ canonical routes App.jsx’de -> Outlet */}
          <Outlet context={{ me, reloadMe: loadMe }} />
        </Content>
      </Layout>

      <Modal
        title="Güvenlik: PIN’ini Güncelle"
        open={pinModalOpen}
        okText="Kaydet"
        cancelText="Çıkış"
        confirmLoading={saving}
        closable={false}
        maskClosable={false}
        onOk={changePin}
        onCancel={doLogout}
      >
        <div style={{ marginBottom: 8, opacity: 0.75 }}>
          İlk giriş / PIN reset sonrası güvenlik için PIN değiştirmen gerekiyor.
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Mevcut PIN</div>
          <Input value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Yeni PIN</div>
          <Input value={newPin} onChange={(e) => setNewPin(e.target.value)} />
        </div>
      </Modal>
    </Layout>
  );
}