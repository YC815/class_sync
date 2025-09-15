import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隱私權政策 - ClassSync",
  description: "ClassSync 隱私權政策與資料使用說明",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pb-safe">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-safe">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-lg md:text-xl font-bold hover:opacity-80 transition-opacity">
                ClassSync
              </Link>
              <span className="text-sm text-muted-foreground">隱私權政策</span>
            </div>
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              回到主頁
            </Link>
          </div>
        </div>
      </nav>

      <main
        className="container mx-auto px-4 py-8 max-w-4xl"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px + 2rem)' }}
      >
      <div className="prose prose-gray max-w-none dark:prose-invert">
        <h1 className="text-3xl font-bold mb-8">隱私權政策</h1>

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-8">
          最後更新日期：2025年1月15日
        </div>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">關於本政策</h2>
          <p className="mb-4">
            ClassSync（「我們」、「本服務」）致力於保護您的隱私權。本隱私權政策說明我們如何收集、使用、儲存和保護您在使用 ClassSync 服務時所提供的個人資料。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">我們收集的資料</h2>
          <div className="mb-4">
            <h3 className="text-xl font-medium mb-2">帳戶資料</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>Google 帳戶基本資料（姓名、電子郵件地址、個人資料相片）</li>
              <li>登入和驗證資訊</li>
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-medium mb-2">課程資料</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>您建立的課程資訊（課程名稱、時間、地點）</li>
              <li>課表設定和偏好</li>
              <li>與 Google Calendar 的同步資料</li>
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-medium mb-2">技術資料</h3>
            <ul className="list-disc pl-6 mb-4">
              <li>裝置類型、瀏覽器資訊</li>
              <li>IP 位址和位置資料（用於系統安全）</li>
              <li>使用記錄和錯誤報告</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">資料使用目的</h2>
          <p className="mb-4">我們收集和使用您的個人資料僅用於以下目的：</p>
          <ul className="list-disc pl-6 mb-4">
            <li>提供課表管理和同步服務</li>
            <li>維護帳戶安全和身份驗證</li>
            <li>改善服務品質和使用者體驗</li>
            <li>提供技術支援和客戶服務</li>
            <li>遵守法律義務和保護合法權益</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Google Calendar 整合</h2>
          <p className="mb-4">
            ClassSync 與 Google Calendar 整合以提供課表同步功能。當您授權此整合時：
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>我們僅會存取您授權的 Google Calendar</li>
            <li>我們只會讀取和寫入與課表相關的活動</li>
            <li>我們不會存取您的其他 Google 服務資料</li>
            <li>您可以隨時撤銷授權</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">資料儲存與安全</h2>
          <p className="mb-4">
            我們採用業界標準的安全措施來保護您的資料：
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>所有資料傳輸都使用 SSL/TLS 加密</li>
            <li>資料庫採用加密儲存</li>
            <li>定期進行安全性檢查和更新</li>
            <li>限制員工對個人資料的存取權限</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">資料分享與揭露</h2>
          <p className="mb-4">
            我們不會向第三方出售、交易或轉移您的個人資料，除非：
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>獲得您的明確同意</li>
            <li>法律要求或法院命令</li>
            <li>保護我們的權利、財產或安全</li>
            <li>與信任的服務提供商合作（如雲端儲存服務）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">您的權利</h2>
          <p className="mb-4">根據相關法律，您擁有以下權利：</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>存取權</strong>：查看我們持有的您的個人資料</li>
            <li><strong>更正權</strong>：要求更正不正確的個人資料</li>
            <li><strong>刪除權</strong>：要求刪除您的個人資料</li>
            <li><strong>限制處理權</strong>：在特定情況下限制資料處理</li>
            <li><strong>資料可攜權</strong>：以結構化格式接收您的資料</li>
            <li><strong>反對權</strong>：反對特定的資料處理活動</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Cookies 使用</h2>
          <p className="mb-4">
            我們使用 Cookies 和類似技術來：
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>維持您的登入狀態</li>
            <li>記住您的偏好設定</li>
            <li>分析網站使用情況</li>
            <li>提升使用者體驗</li>
          </ul>
          <p className="mb-4">
            您可以在瀏覽器設定中管理 Cookies 偏好。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">未成年人隱私</h2>
          <p className="mb-4">
            ClassSync 不會故意收集 13 歲以下兒童的個人資料。如果您是未成年人的父母或監護人，並相信我們收集了您孩子的個人資料，請立即聯繫我們。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">政策更新</h2>
          <p className="mb-4">
            我們可能會定期更新本隱私權政策。重大變更時，我們會在服務中顯著位置發布通知。繼續使用服務即表示您接受更新後的政策。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">聯絡我們</h2>
          <p className="mb-4">
            如果您對本隱私權政策有任何疑問或需要行使您的權利，請透過以下方式聯繫我們：
          </p>
          <ul className="list-none pl-0 mb-4">
            <li className="mb-2"><strong>電子郵件：</strong> privacy@classsync.example.com</li>
            <li className="mb-2"><strong>回應時間：</strong> 我們將在 7 個工作天內回覆您的詢問</li>
          </ul>
        </section>

        <div className="border-t pt-8 mt-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            本隱私權政策依據中華民國個人資料保護法制定，並符合歐盟一般資料保護規範（GDPR）的相關要求。
          </p>
        </div>
      </div>
      </main>
    </div>
  );
}