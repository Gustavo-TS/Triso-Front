export const CAMPAIGNS = {
  dralfredo: {
    id: "dralfredo",
    name: "Dr. Zé Alfredo",
    number: "4063",
    instagram: "dr.zealfredo",
    templateUrl: import.meta.env.VITE_DRALFREDO_TEMPLATE_URL || "/DrAlfredo/drAlfredo4063.png",
    trackingEnabled: true,
    copy: {
      kicker: "SEU APOIO FAZ A DIFERENÇA",
      description: "Envie sua foto, gere seu selo de apoio e compartilhe esta mensagem com quem acredita em uma cidade melhor.",
      thanks: "Obrigado por estar com o Dr. Zé Alfredo.",
    },
    theme: {
      primary: "#075fbd",
      deep: "#003773",
      accent: "#ffdd19",
      action: "#d70010",
      actionHover: "#b8000d",
    },
  },
  marlonreis: {
    id: "marlonreis",
    name: "Marlon Reis",
    number: "1899",
    instagram: "marlonreisadv",
    templateUrl: import.meta.env.VITE_MARLONREIS_TEMPLATE_URL || "/MarlonReis/MarlonReis1899.png",
    trackingEnabled: false,
    copy: {
      kicker: "SEU APOIO FAZ A DIFERENÇA",
      description: "Envie sua foto, gere seu selo de apoio e compartilhe esta mensagem com quem acredita em um Brasil mais justo.",
      thanks: "Obrigado por estar com Marlon Reis.",
    },
    theme: {
      primary: "#1d6eef",
      deep: "#073584",
      accent: "#f8d62a",
      action: "#0c46b8",
      actionHover: "#083892",
    },
  },
};

export const getCampaign = (id) => CAMPAIGNS[id];
