import { useEffect, useState, useCallback } from "react";
import { Button, Form, Input, InputNumber, Modal, Space, Switch, Table, message } from "antd";
import api from "../api";

export default function Hospitals() {
  const [rows, setRows] = useState([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // ✅ Yetkililer modal state + form
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [contactEditing, setContactEditing] = useState(null);
  const [contactForm] = Form.useForm();

  const load = useCallback(async () => {
    const { data } = await api.get("/hospitals");
    setRows(data || []);
  }, []);

  const loadContacts = useCallback(async (hospital) => {
    if (!hospital?.id) return;
    const { data } = await api.get(`/hospitals/${hospital.id}/contacts`);
    setContacts(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ✅ Modal açılınca formu doldur (Modal kapalıyken setFieldsValue çağırma!)
  useEffect(() => {
    if (!open) return;

    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        priorityOrder: editing.priorityOrder,
        isActive: editing.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ isActive: true, priorityOrder: 999 });
    }
  }, [open, editing, form]);

  // ✅ Contacts modal açılınca ve edit değişince formu doldur
  useEffect(() => {
    if (!contactsOpen) return;

    if (contactEditing) {
      contactForm.setFieldsValue({
        nameSurname: contactEditing.nameSurname,
        title: contactEditing.title,
        phone: contactEditing.phone,
        email: contactEditing.email,
        note: contactEditing.note,
        isActive: contactEditing.isActive !== undefined ? contactEditing.isActive : true,
      });
    } else {
      contactForm.resetFields();
      contactForm.setFieldsValue({ isActive: true });
    }
  }, [contactsOpen, contactEditing, contactForm]);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setOpen(true);
  };

  const closeHospitalModal = () => {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const closeContactsModal = () => {
    setContactsOpen(false);
    setSelectedHospital(null);
    setContacts([]);
    setContactEditing(null);
    contactForm.resetFields();
  };

  const onFinishHospital = async (values) => {
    try {
      if (editing) {
        await api.put(`/hospitals/${editing.id}`, values);
        message.success("Güncellendi");
      } else {
        await api.post("/hospitals", values);
        message.success("Eklendi");
      }
      closeHospitalModal();
      await load();
    } catch (e) {
      message.error(e?.response?.data?.error || "İşlem başarısız");
    }
  };

  const onFinishContact = async (v) => {
    if (!selectedHospital?.id) return;
    try {
      const payload = {
        ...v,
        isActive: v.isActive !== undefined ? v.isActive : true,
      };

      if (contactEditing) {
        await api.put(`/hospital-contacts/${contactEditing.id}`, payload);
        message.success("Güncellendi");
      } else {
        await api.post(`/hospitals/${selectedHospital.id}/contacts`, payload);
        message.success("Eklendi");
      }

      setContactEditing(null);
      contactForm.resetFields();
      contactForm.setFieldsValue({ isActive: true });
      await loadContacts(selectedHospital);
    } catch (e) {
      message.error(e?.response?.data?.error || "İşlem başarısız");
    }
  };

  const columns = [
    { title: "Öncelik", dataIndex: "priorityOrder" },
    { title: "Hastane", dataIndex: "name" },
    { title: "Aktif", dataIndex: "isActive", render: (v) => (v ? "Evet" : "Hayır") },
    {
      title: "İşlem",
      render: (_, r) => (
        <Space>
          <Button onClick={() => openEdit(r)}>Düzenle</Button>

          {/* ✅ Yetkililer butonu */}
          <Button
            onClick={async () => {
              setSelectedHospital(r);
              setContactsOpen(true);
              setContactEditing(null);
              await loadContacts(r);
            }}
          >
            Yetkililer
          </Button>

          <Button
            danger
            onClick={() => {
              Modal.confirm({
                title: "Silmek istiyor musunuz?",
                content: "Bu işlem geri alınamaz.",
                okText: "Sil",
                okButtonProps: { danger: true },
                cancelText: "Vazgeç",
                onOk: async () => {
                  await api.delete(`/hospitals/${r.id}`);
                  message.success("Silindi");
                  await load();
                },
              });
            }}
          >
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openCreate}>
          Yeni Hastane
        </Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={rows} />

      {/* Hastane Ekle/Düzenle */}
      <Modal
        title={editing ? "Hastane Düzenle" : "Yeni Hastane"}
        open={open}
        onCancel={closeHospitalModal}
        onOk={() => form.submit()}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinishHospital}>
          <Form.Item name="name" label="Hastane Adı" rules={[{ required: true, message: "Hastane adı zorunlu" }]}>
            <Input placeholder="Safranbolu DH" />
          </Form.Item>

          <Form.Item
            name="priorityOrder"
            label="Öncelik (1 en yüksek)"
            rules={[{ required: true, message: "Öncelik zorunlu" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="isActive" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ✅ Yetkililer Modalı */}
      <Modal
        title={`Hastane Yetkilileri — ${selectedHospital?.name || ""}`}
        open={contactsOpen}
        onCancel={closeContactsModal}
        footer={null}
        width={900}
        destroyOnHidden
      >
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
          <Button
            type="primary"
            onClick={() => {
              setContactEditing(null); // useEffect modal açıkken formu reset + default yapacak
            }}
          >
            Yeni Yetkili
          </Button>
        </Space>

        <Form layout="vertical" form={contactForm} onFinish={onFinishContact}>
          <Space wrap style={{ width: "100%" }}>
            <Form.Item
              name="nameSurname"
              label="Ad Soyad"
              rules={[{ required: true, message: "Ad Soyad zorunlu" }]}
              style={{ width: 260 }}
            >
              <Input />
            </Form.Item>

            <Form.Item name="title" label="Ünvan" style={{ width: 200 }}>
              <Input />
            </Form.Item>

            <Form.Item name="phone" label="Telefon" style={{ width: 170 }}>
              <Input />
            </Form.Item>

            <Form.Item name="email" label="E-posta" style={{ width: 220 }}>
              <Input />
            </Form.Item>

            <Form.Item name="isActive" label="Aktif" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="note" label="Not">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit">
              {contactEditing ? "Güncelle" : "Kaydet"}
            </Button>

            {contactEditing && (
              <Button onClick={() => setContactEditing(null)}>
                Vazgeç
              </Button>
            )}
          </Space>
        </Form>

        <div style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            dataSource={contacts}
            columns={[
              { title: "Ad Soyad", dataIndex: "nameSurname" },
              { title: "Ünvan", dataIndex: "title" },
              { title: "Telefon", dataIndex: "phone" },
              { title: "E-posta", dataIndex: "email" },
              { title: "Aktif", dataIndex: "isActive", render: (v) => (v ? "Evet" : "Hayır") },
              {
                title: "İşlemler",
                render: (_, r) => (
                  <Space>
                    <Button size="small" onClick={() => setContactEditing(r)}>
                      Düzenle
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: "Silmek istiyor musunuz?",
                          content: "Bu işlem geri alınamaz.",
                          okText: "Sil",
                          okButtonProps: { danger: true },
                          cancelText: "Vazgeç",
                          onOk: async () => {
                            await api.delete(`/hospital-contacts/${r.id}`);
                            message.success("Silindi");
                            await loadContacts(selectedHospital);
                          },
                        });
                      }}
                    >
                      Sil
                    </Button>
                  </Space>
                ),
              },
            ]}
            pagination={{ pageSize: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
}