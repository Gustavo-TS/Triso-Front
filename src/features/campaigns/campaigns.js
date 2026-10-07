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
    trackingEnabled: true,
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
  nathanbarbearia: {
    id: "nathanbarbearia",
    name: "Nathan Barbearia",
    number: "",
    instagram: "nathanbarbearia",
    templateUrl: "/NathanBarbearia/nathan_barbearia_transparente.png",
    trackingEnabled: false,
    brandPage: true,
    copy: {
      kicker: "SELO OFICIAL · NATHAN BARBEARIA",
      description: "Escolha uma foto sua e crie um selo exclusivo para mostrar que você faz parte da nossa comunidade.",
      thanks: "Agora você faz parte do time Nathan.",
    },
    theme: { primary: "#171717", deep: "#050505", accent: "#c99a55", action: "#c99a55", actionHover: "#e0b875" },
  },
  portalnoticiasbahia: {
    id: "portalnoticiasbahia", name: "Portal Notícias Bahia", number: "", instagram: "portalnoticiasbahia",
    templateUrl: "/PortalBahia/portalbahia.png", trackingEnabled: true, brandPage: true,
    copy: { kicker: "SELO OFICIAL · PORTAL NOTÍCIAS BAHIA", description: "Escolha uma foto sua e crie seu selo para mostrar que você acompanha as notícias da Bahia.", thanks: "Você faz parte da nossa comunidade." },
    theme: { primary: "#0756a8", deep: "#062b59", accent: "#f5c400", action: "#d62828", actionHover: "#b51f1f" },
  },
};

export const getCampaign = (id) => CAMPAIGNS[id];
