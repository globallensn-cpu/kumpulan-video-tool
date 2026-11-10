import { SiteHeader } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { Downloader } from "@/components/downloader";
import { Steps } from "@/components/site/steps";
import { Features } from "@/components/site/features";
import { Faq } from "@/components/site/faq";
import { Contact } from "@/components/site/contact";
import { SiteFooter } from "@/components/site/footer";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <Hero />

        {/* Main tool */}
        <section className="pb-16 sm:pb-20" aria-label="Alat pengunduh video Shopee">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Downloader />
          </div>
        </section>

        <Steps />
        <Features />
        <Faq />
        <Contact />
      </main>

      <SiteFooter />
    </>
  );
}
