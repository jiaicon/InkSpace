import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Popconfirm, Select, Space, Switch, Table, message } from 'antd'
import type { TableProps } from 'antd'
import { userApi } from '../api/user'
import type { User, UserInput } from '@shared/types'

export default function UserManage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<UserInput>()

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await userApi.list())
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onFinish = async (values: UserInput) => {
    setSubmitting(true)
    try {
      await userApi.create(values)
      message.success('创建成功')
      form.resetFields()
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (id: number) => {
    try {
      await userApi.remove(id)
      message.success('已删除')
      await load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const columns: TableProps<User>['columns'] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email' },
    { title: '角色', dataIndex: 'role' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: number) => <Switch size="small" checked={v === 1} disabled />
    },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, r) => (
        <Popconfirm title="确定删除？" onConfirm={() => onDelete(r.id)}>
          <Button danger size="small">
            删除
          </Button>
        </Popconfirm>
      )
    }
  ]

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex', padding: 24 }}>
      <Card title="新建用户">
        <Form form={form} layout="inline" onFinish={onFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录名" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="邮箱" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user">
            <Select
              style={{ width: 110 }}
              options={[
                { value: 'admin', label: '管理员' },
                { value: 'user', label: '用户' },
                { value: 'guest', label: '访客' }
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue={1}>
            <Select
              style={{ width: 90 }}
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '禁用' }
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="用户列表">
        <Table rowKey="id" columns={columns} dataSource={users} loading={loading} />
      </Card>
    </Space>
  )
}
