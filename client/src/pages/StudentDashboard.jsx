import React from "react";
import { Card, Typography } from "antd";

export default function StudentDashboard({ me }) {
  return (
    <Card title="Hoş geldin">
      <div style={{ fontSize: 18, fontWeight: 800 }}>{me?.nameSurname || "—"}</div>
      <Typography.Text type="secondary">
        {me?.period ? `${me.period.academicYear} · ${me.period.term} · ${me.period.courseName || ""}` : ""}
      </Typography.Text>
      <div style={{ marginTop: 12 }}>
        Buradan haftalık raporlarını doldurabileceksin. (Bir sonraki adım)
      </div>
    </Card>
  );
}