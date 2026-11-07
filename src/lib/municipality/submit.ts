import type { Municipality, SubmitMethod } from "../../../types/municipality";

export type SubmitAction = {
  method: SubmitMethod;
  label: string;
  primary: boolean;
  href?: string;
  copyText?: string;
  description?: string;
};

const methodOrder: SubmitMethod[] = [
  "online_form",
  "email",
  "mail",
  "in_person",
  "fax",
];

const methodLabels: Record<SubmitMethod, string> = {
  online_form: "オンラインフォーム",
  email: "メール",
  mail: "郵送",
  in_person: "持参",
  fax: "FAX",
};

export function getOrderedSubmitMethods(methods: SubmitMethod[]): SubmitMethod[] {
  return methodOrder.filter((method) => methods.includes(method));
}

export function getSubmitMethodLabel(method: SubmitMethod): string {
  return methodLabels[method];
}

export function buildEmailContent(
  municipality: Municipality,
  type: "assembly" | "executive",
  body: string,
): { subject: string; body: string } {
  const destination = type === "assembly" ? "議会" : "行政";
  return {
    subject: `${municipality.name}への${destination}要望`,
    body: `${municipality.name}${destination} 御中\n\n${body}\n\n--\nこのメールは陳情・要望書作成サイトで作成しました。`,
  };
}

export function getSubmitActions(
  municipality: Municipality,
  type: "assembly" | "executive",
): SubmitAction[] {
  const info = municipality[type];
  const orderedMethods = getOrderedSubmitMethods(info.submitMethods);
  const emailContent = buildEmailContent(municipality, type, "（ここに本文を入力してください）");

  return orderedMethods.map((method, index) => {
    const action: SubmitAction = {
      method,
      label: getSubmitMethodLabel(method),
      primary: index === 0,
    };

    if (method === "online_form") {
      const officialUrl = type === "assembly" ? info.secretariatUrl : undefined;
      action.href = info.onlineFormUrl ?? officialUrl ?? municipality.common?.website ?? undefined;
      action.description = "自治体の公式フォームから提出します。";
    } else if (method === "email") {
      action.href = info.email ? `mailto:${info.email}?subject=${encodeURIComponent(emailContent.subject)}` : undefined;
      action.copyText = info.email ? emailContent.body : undefined;
      action.description = info.email ? `送信先: ${info.email}` : "メールアドレスは未登録です。";
    } else if (method === "mail") {
      action.copyText = info.postalAddress ?? undefined;
      action.description = info.postalAddress ? `郵送先: ${info.postalAddress}` : "郵送先住所は未登録です。";
    } else if (method === "in_person") {
      action.copyText = info.postalAddress ?? undefined;
      action.description = info.postalAddress ? `窓口: ${info.postalAddress}` : "窓口の所在地は公式サイトでご確認ください。";
    } else {
      // TODO: スクレイピングで後から埋める。
      action.description = "FAX番号は公式サイトでご確認ください。";
    }

    return action;
  });
}
