'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { Card, Row, Col, Statistic, Skeleton, Tag, Typography } from 'antd';
import {
	ArrowUpOutlined,
	BellOutlined,
	EyeOutlined,
	SendOutlined,
	MailOutlined,
} from '@ant-design/icons';
import {
	usePlatformCommunicationStats,
	usePlatformNotificationStats,
} from '@/hooks/use-platform-stats';
import { PageError, DataTable } from '@autional/ui/antd';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	Legend,
} from 'recharts';

const { Title } = Typography;

const CHANNEL_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)'];
const TYPE_COLORS = ['var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-1)', 'var(--color-chart-6)'];
const PIE_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)'];

const statusLabels: Record<string, string> = {
	sent: '已发送',
	delivered: '已送达',
	failed: '失败',
	pending: '待处理',
	scheduled: '已排期',
};

export default function PlatformNotificationsPage() {
	const {
		data: comm,
		isLoading: commLoading,
		error: commError,
		refetch: commRefetch,
	} = usePlatformCommunicationStats();
	const {
		data: notif,
		isLoading: notifLoading,
		error: notifError,
		refetch: notifRefetch,
	} = usePlatformNotificationStats();

	const isLoading = commLoading || notifLoading;

	const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
	const refetchRef = useRef({ comm: commRefetch, notif: notifRefetch });
	refetchRef.current = { comm: commRefetch, notif: notifRefetch };

	useEffect(() => {
		intervalRef.current = setInterval(() => {
			refetchRef.current.comm();
			refetchRef.current.notif();
		}, 30000);
		return () => clearInterval(intervalRef.current);
	}, []);

	const channelPieData = useMemo(() => {
		if (!comm?.byChannel) return [];
		return Object.entries(comm.byChannel).map(([name, value]) => ({
			name: name.toUpperCase(),
			value,
		}));
	}, [comm?.byChannel]);

	const statusTableData = useMemo(() => {
		if (!comm?.byStatus) return [];
		return Object.entries(comm.byStatus).map(([status, count]) => ({
			key: status,
			status,
			label: statusLabels[status] || status,
			count,
		}));
	}, [comm?.byStatus]);

	const typePieData = useMemo(() => {
		if (!notif?.byType) return [];
		return Object.entries(notif.byType).map(([name, value]) => ({ name, value }));
	}, [notif?.byType]);

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<Title level={4} className="!mb-0">
					平台通信与通知
				</Title>
				<span className="text-neutral-600 text-xs">每 30 秒自动刷新</span>
			</div>
			{/* PL-31：两卡数字来源不同服务、时间窗不同（消息=通信服务近 30 天；通知=站内全量累计），不注明会被当矛盾 */}
			<div className="text-neutral-600 text-xs mb-6">
				口径说明：「消息」= 通信服务（短信 / 邮件等渠道）近 30 天发送量；「通知」= 站内通知全量累计（无时间窗）。
				两者来源不同服务、统计范围不同，数字不可直接比较。
			</div>

			{(commError || notifError) && (
				<PageError
					message="加载平台统计失败"
					retry={() => {
						commRefetch();
						notifRefetch();
					}}
					className="mb-4"
				/>
			)}

			<Row gutter={[16, 16]}>
				<Col xs={24} sm={12} lg={6}>
					<Card>
						{isLoading ? (
							<Skeleton active paragraph={{ rows: 0 }} />
						) : (
							<Statistic
								title="近 30 天已发送消息"
								value={comm?.totalSent ?? 0}
								prefix={<SendOutlined className="text-info" />}
							/>
						)}
					</Card>
				</Col>
				<Col xs={24} sm={12} lg={6}>
					<Card>
						{isLoading ? (
							<Skeleton active paragraph={{ rows: 0 }} />
						) : (
							<Statistic
								title="送达率"
								value={comm?.deliveryRate ? Math.round(comm.deliveryRate * 10000) / 100 : 0}
								suffix="%"
								precision={1}
								valueStyle={{ color: (comm?.deliveryRate ?? 0) > 0.9 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}
							/>
						)}
					</Card>
				</Col>
				<Col xs={24} sm={12} lg={6}>
					<Card>
						{isLoading ? (
							<Skeleton active paragraph={{ rows: 0 }} />
						) : (
							<Statistic
								title="通知总数（累计）"
								value={notif?.totalSent ?? 0}
								prefix={<BellOutlined className="text-chart-7" />}
							/>
						)}
					</Card>
				</Col>
				<Col xs={24} sm={12} lg={6}>
					<Card>
						{isLoading ? (
							<Skeleton active paragraph={{ rows: 0 }} />
						) : (
							<Statistic
								title="通知已读率"
								value={notif?.readRate ? Math.round(notif.readRate * 10000) / 100 : 0}
								suffix="%"
								precision={1}
								prefix={<EyeOutlined className="text-success" />}
								valueStyle={{ color: (notif?.readRate ?? 0) > 0.4 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}
							/>
						)}
					</Card>
				</Col>
			</Row>

			<Row gutter={[16, 16]} className="mt-6">
				<Col xs={24} lg={12}>
					<Card title="按渠道统计消息">
						{isLoading ? (
							<Skeleton active paragraph={{ rows: 5 }} />
						) : (
							<ResponsiveContainer width="100%" height={280}>
								<PieChart>
									<Pie
										data={channelPieData}
										cx="50%"
										cy="50%"
										outerRadius={100}
										dataKey="value"
										label={({ name, value }) => `${name}: ${value}`}
									>
										{channelPieData.map((_, idx) => (
											<Cell key={idx} fill={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} />
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						)}
					</Card>
				</Col>
				<Col xs={24} lg={12}>
					<Card title="按类型统计通知">
						{isLoading ? (
							<Skeleton active paragraph={{ rows: 5 }} />
						) : (
							<ResponsiveContainer width="100%" height={280}>
								<PieChart>
									<Pie
										data={typePieData}
										cx="50%"
										cy="50%"
										outerRadius={100}
										dataKey="value"
										label={({ name, value }) => `${name}: ${value}`}
									>
										{typePieData.map((_, idx) => (
											<Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						)}
					</Card>
				</Col>
			</Row>

			<Card title="消息状态分布" className="mt-6">
				{isLoading ? (
					<Skeleton active paragraph={{ rows: 4 }} />
				) : (
					<DataTable
						dataSource={statusTableData}
						pagination={false}
						size="small"
						rowKey="status"
						columns={[
							{
								title: '状态',
								dataIndex: 'status',
								key: 'status',
								render: (v: string) => <Tag>{v}</Tag>,
							},
							{
								title: '数量',
								dataIndex: 'count',
								key: 'count',
								render: (v: number) => v.toLocaleString(),
							},
						]}
					/>
				)}
			</Card>
		</div>
	);
}
