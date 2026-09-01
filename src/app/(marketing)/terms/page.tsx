import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos aplicáveis ao uso da plataforma SOBE.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      description="Estas regras explicam, de forma objetiva, as condições para criar, publicar e operar uma estrutura digital com a SOBE."
      updatedAt="31 de agosto de 2026"
    >
      <section>
        <h2>Uso do serviço</h2>
        <p className="mt-4">
          A SOBE permite criar projetos, organizar jornadas guiadas e publicar
          páginas que conduzem visitantes a ações como pedir, agendar,
          qualificar, reservar ou comprar. Você deve usar o serviço de forma
          lícita, respeitando estes termos e os direitos de terceiros.
        </p>
      </section>

      <section>
        <h2>Conta e acesso</h2>
        <p className="mt-4">
          Você é responsável por fornecer informações corretas, manter suas
          credenciais protegidas e controlar quem acessa o seu workspace. Avise
          o suporte se identificar uso não autorizado da conta.
        </p>
      </section>

      <section>
        <h2>Dados do negócio</h2>
        <p className="mt-4">
          As informações, fontes e configurações enviadas à SOBE devem
          pertencer ao seu negócio ou estar autorizadas para uso. Você continua
          responsável pela exatidão das ofertas, horários, preços, canais e
          demais dados apresentados aos visitantes.
        </p>
      </section>

      <section>
        <h2>Conteúdo publicado</h2>
        <p className="mt-4">
          Você mantém a responsabilidade pelo conteúdo que publica, incluindo
          textos, imagens, marcas e caminhos de conversão. Não publique material
          ilegal, enganoso, ofensivo ou que viole propriedade intelectual,
          privacidade ou outros direitos.
        </p>
      </section>

      <section>
        <h2>SOBE Pro e cobrança</h2>
        <p className="mt-4">
          Recursos pagos são oferecidos pelo plano SOBE Pro conforme o preço, o
          período de teste e os limites exibidos na contratação. A cobrança é
          processada por provedor de pagamentos, e cancelamentos ou mudanças de
          plano seguem as condições apresentadas no painel no momento da ação.
        </p>
      </section>

      <section>
        <h2>Disponibilidade e alterações</h2>
        <p className="mt-4">
          Podemos realizar manutenções, corrigir falhas e atualizar recursos
          para proteger ou melhorar o serviço. Quando uma mudança relevante
          afetar estes termos, a versão atualizada será publicada nesta página.
        </p>
      </section>

      <section>
        <h2>Limitação de responsabilidade</h2>
        <p className="mt-4">
          A SOBE oferece infraestrutura para organizar jornadas e acompanhar
          resultados, mas não garante vendas, agendamentos ou qualquer resultado
          comercial. Na extensão permitida pela lei, não respondemos por perdas
          indiretas, decisões tomadas com base em conteúdo do usuário ou falhas
          de serviços de terceiros fora do nosso controle.
        </p>
      </section>

      <section>
        <h2>Contato</h2>
        <p className="mt-4">
          Dúvidas sobre estes termos podem ser enviadas por e-mail, usando o
          endereço de suporte informado no painel e nos canais oficiais da SOBE.
        </p>
      </section>
    </LegalPage>
  );
}
