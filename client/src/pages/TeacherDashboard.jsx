// client/src/pages/TeacherDashboard.jsx
import React, { useEffect, useState } from "react";
import { Card, Typography } from "antd";
import api from "../api";

const dayLabel = { MON: "Pzt", TUE: "Sal", WED: "Çar", THU: "Per", FRI: "Cum", SAT: "Cmt", SUN: "Paz" };

export default function TeacherDashboard() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/teacher/me");

        // ✅ Backend bazen {ok:true,user:{...}} döndürebilir, bazen direkt user döner.
        const payload = data?.user ?? data;
        setMe(payload || null);
      } catch (e) {
        setMe(null);
      }
    })();
  }, []);

  const flags = me?.flags || {};
  const isCoordinator = !!(me?.isCoordinator ?? flags.isCoordinator);
  const isObserver = !!(me?.isObserver ?? flags.isObserver);
  const isResponsible = !!(me?.isResponsible ?? flags.isResponsible);

  const rolesText =
    [isCoordinator ? "Koordinatör" : null, isObserver ? "Gözlemci" : null, isResponsible ? "Ders Sorumlusu" : null]
      .filter(Boolean)
      .join(" + ") || "-";

  const practiceDaysRaw = me?.practiceDays || [];
  const days = practiceDaysRaw.map((d) => dayLabel[d] || d);

  const hospitalNames = (me?.hospitals || [])
    .map((x) => x?.hospital?.name)
    .filter(Boolean);

  const displayName = me?.nameSurname || me?.name || me?.fullName || me?.username || "-";

  return (
    <Card title="Hoş geldiniz">
      {!me ? (
        <Typography.Text type="secondary">Yükleniyor…</Typography.Text>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{displayName}</div>

          <div style={{ marginTop: 8, color: "#666" }}>
            <div>
              <b>Roller:</b> {rolesText}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Günler:</b> {days.length ? days.join(", ") : "-"}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Hastaneler:</b> {hospitalNames.length ? hospitalNames.join(", ") : "-"}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}