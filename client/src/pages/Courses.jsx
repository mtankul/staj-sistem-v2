import { useEffect, useState } from "react";
import { Button, Form, Input, Modal, Switch, Table, Space, message } from "antd";
import api from "../api";

export default function Courses() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  async function load() {
    const { data } = await api.get("/courses");
    setRows(data);
  }

  useEffect(() => { load(); }, []);

  const columns = [
    { title: "Kod", dataIndex: "code" },
    { title: "Ad", dataIndex: "name" },
    {
      title: "Aktif",
      dataIndex: "isActive",
      render: (v) => (v ? "Evet" : "Hayır"),
    },
    {
      title: "İşlem",
      render: (_, r) => (
        <Space>
          <Button onClick={() => {
            setEditing(r);
            form.setFieldsValue(r);
            setOpen(true);
          }}>
            Düzenle
          </Button>
          <Button danger onClick={async () => {
            await api.delete(`/courses/${r.id}`);
            message.success("Silindi");
            load();
          }}>
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => {
          setEditing(null);
          form.resetFields();
          form.setFieldsValue({ isActive: true });
          setOpen(true);
        }}>
          Yeni Ders
        </Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={rows} />

      <Modal
        title={editing ? "Ders Düzenle" : "Yeni Ders"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          if (editing) {
            await api.put(`/courses/${editing.id}`, values);
            message.success("Güncellendi");
          } else {
            await api.post("/courses", values);
            message.success("Eklendi");
          }
          setOpen(false);
          load();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Kod (MU1, MU2)" rules={[{ required: true }]}>
            <Input placeholder="MU1" />
          </Form.Item>
          <Form.Item name="name" label="Ders Adı" rules={[{ required: true }]}>
            <Input placeholder="Mesleki Uygulama I" />
          </Form.Item>
          <Form.Item name="isActive" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}