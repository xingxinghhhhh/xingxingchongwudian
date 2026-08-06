const productTitleLabels: Record<string, string> = {
  "Durable bite rope": "耐咬棉绳玩具",
  "Cat teaser wand set": "猫咪逗趣羽毛杆套装"
};

const productDescriptionLabels: Record<string, string> = {
  "A washable cotton rope toy for daily tug and chew play.": "可清洗棉绳玩具，适合日常拉扯和啃咬。",
  "A light interactive wand set for indoor cat hunting play.": "轻巧互动逗猫杆套装，适合室内捕猎游戏。"
};

const productTagLabels: Record<string, string> = {
  "daily-care": "日常照顾",
  "tug-play": "拉扯互动",
  washable: "可清洗",
  feather: "羽毛",
  hunting: "捕猎游戏",
  "indoor-play": "室内玩耍"
};

const petTypeLabels: Record<string, string> = {
  dog: "狗狗",
  cat: "猫猫",
  both: "通用"
};

const toyTypeLabels: Record<string, string> = {
  chew: "啃咬玩具",
  interactive: "互动玩具"
};

const paymentStatusLabels: Record<string, string> = {
  created: "已创建",
  pending: "待支付",
  paid: "已支付",
  failed: "支付失败",
  expired: "已过期",
  cancelled: "已取消"
};

const paymentProviderLabels: Record<string, string> = {
  mock_wechat: "模拟微信",
  mock_alipay: "模拟支付宝"
};

const memberCancelReasonLabels: Record<string, string> = {
  ORDER_CREATED_BY_MISTAKE: "误创建订单",
  CHANGED_MIND: "暂时不想买了",
  WRONG_PRODUCT: "选错商品",
  WRONG_ADDRESS: "地址填写错误",
  FOUND_BETTER_OPTION: "找到了更合适的商品",
  OTHER: "其他"
};

const paymentFailureLabels: Record<string, string> = {
  INSUFFICIENT_BALANCE: "余额不足，请更换支付方式。",
  PAYMENT_DECLINED: "支付被拒绝，请稍后重试。",
  PROVIDER_UNAVAILABLE: "支付渠道暂不可用，请稍后再试。",
  USER_CANCELLED_PAYMENT: "用户已取消支付。",
  UNKNOWN_PROVIDER_ERROR: "支付渠道返回未知错误。"
};

export function getProductTitleLabel(value: string) {
  return productTitleLabels[value] ?? value;
}

export function getProductDescriptionLabel(value: string) {
  return productDescriptionLabels[value] ?? value;
}

export function getProductTagLabel(value: string) {
  return productTagLabels[value] ?? value;
}

export function getPetTypeLabel(value: string) {
  return petTypeLabels[value] ?? value;
}

export function getToyTypeLabel(value: string) {
  return toyTypeLabels[value] ?? value;
}

export function getPaymentStatusLabel(value: string) {
  return paymentStatusLabels[value] ?? value;
}

export function getPaymentProviderLabel(value: string) {
  return paymentProviderLabels[value] ?? value;
}

export function getMemberCancelReasonLabel(value: string) {
  return memberCancelReasonLabels[value] ?? value;
}

export function getPaymentFailureLabel(value?: string, fallback?: string) {
  if (value) {
    return paymentFailureLabels[value] ?? fallback ?? value;
  }

  return fallback ?? "支付失败，请重新发起一次支付。";
}

export function listMemberCancelReasonLabels() {
  return Object.entries(memberCancelReasonLabels);
}
