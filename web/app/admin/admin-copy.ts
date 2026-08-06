import type { AdminPermission, AdminStaffProfile, MerchantAnalytics } from "./admin-api";

const permissionLabels: Record<AdminPermission, string> = {
  "audit:read": "查看审计日志",
  "catalog:write": "管理商品",
  "customers:write": "管理客户",
  "cms:write": "管理运营内容",
  "cloud_pets:write": "管理云养宠",
  "community:moderate": "审核社区内容",
  "fulfillment:write": "管理订单履约",
  "marketing:write": "管理营销活动",
  "reviews:moderate": "审核商品评价",
  "refunds:write": "处理退款"
};

const funnelCopy: Record<string, { title: string; actionLabel: string }> = {
  cloud_pet_created: { title: "已创建云养宠", actionLabel: "保持宠物创建引导" },
  homepage_engaged: { title: "已访问宠物主页", actionLabel: "推广可分享宠物主页" },
  order_created: { title: "已创建订单", actionLabel: "引导购物车结算" },
  paid_customer: { title: "已支付客户", actionLabel: "下发购后成长任务" },
  repeat_customer: { title: "复购客户", actionLabel: "推荐会员组合" }
};

const segmentCopy: Record<string, { title: string; description: string; actionLabel: string }> = {
  high_value_pet_parent: {
    title: "高价值云养宠家长",
    description: "已创建云养宠且至少完成两笔支付订单，适合组合商品、会员权益和等级升级运营。",
    actionLabel: "发送会员组合优惠"
  },
  pet_parent_activation: {
    title: "待首单云养宠家长",
    description: "已经通过云养宠建立情感连接，但尚未完成首笔支付订单。",
    actionLabel: "推送首单优惠券"
  },
  commerce_without_pet: {
    title: "未创建云养宠的商城客户",
    description: "已经产生消费但尚未创建云养宠，适合引导进入长期留存体验。",
    actionLabel: "邀请创建云养宠"
  },
  community_growth_fan: {
    title: "社区与主页活跃会员",
    description: "通过宠物主页访问或社区发帖表现出持续互动意愿。",
    actionLabel: "启动连续成长任务"
  },
  payment_recovery: {
    title: "待支付挽回会员",
    description: "存在待支付订单且尚无已支付订单，应优先发送支付提醒或协助结算。",
    actionLabel: "发送支付提醒"
  }
};

const statusLabels: Record<string, string> = {
  active: "启用",
  paused: "暂停",
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
  pending_payment: "待支付",
  paid: "已支付",
  shipped: "已发货",
  completed: "已完成",
  cancelled: "已取消",
  pending_review: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  visible: "已展示",
  hidden: "已隐藏",
  reviewed: "已处理",
  dismissed: "已驳回",
  in_transit: "运输中",
  out_for_delivery: "派送中",
  delivered: "已签收",
  exception: "配送异常",
  on_track: "正常",
  due_soon: "即将超时",
  overdue: "已超时",
  success: "成功",
  failed: "失败",
  pending: "处理中",
  needs_care: "需要照护",
  steady: "稳定",
  thriving: "状态良好"
};

const operationActionLabels: Record<string, string> = {
  "security.admin_login": "后台员工登录",
  "security.admin_logout": "后台员工退出",
  "cloud_pets.daily_diary.backfill": "补救云养宠日记",
  "cloud_pets.daily_diary.generate": "生成云养宠日记"
};

export function getAdminRoleLabel(role: AdminStaffProfile["role"]) {
  return role === "owner" ? "所有者" : "运营人员";
}

export function getAdminStaffNameLabel(name: string) {
  if (name === "Owner Admin") {
    return "系统所有者";
  }

  return name === "Operator Staff" || name === "Operations Admin" ? "运营人员" : name;
}

export function getPermissionLabel(permission: AdminPermission) {
  return permissionLabels[permission];
}

export function getRetentionFunnelCopy(stage: MerchantAnalytics["retentionFunnel"][number]) {
  return funnelCopy[stage.key] ?? stage;
}

export function getCustomerSegmentCopy(segment: MerchantAnalytics["customerSegments"][number]) {
  return segmentCopy[segment.key] ?? segment;
}

export function getPriorityLabel(priority: "high" | "medium" | "low") {
  return { high: "高", medium: "中", low: "低" }[priority];
}

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function getOperationActionLabel(action: string) {
  return operationActionLabels[action] ?? action;
}

export function getOperationTargetLabel(targetType: string) {
  return {
    admin_session: "后台会话",
    cloud_pet: "云养宠",
    order: "订单",
    payment: "支付单",
    community_post: "社区帖子"
  }[targetType] ?? targetType;
}

export function getRiskLevelLabel(level: string) {
  return { high: "高", medium: "中", low: "低" }[level] ?? level;
}

export function getCustomerTagLabel(tag: string) {
  return {
    vip_candidate: "VIP 候选客户",
    cloud_pet_parent: "云养宠家长"
  }[tag] ?? tag;
}
