import { Header } from '@/components/layout/Header'
import { ShippingBanner } from '@/components/layout/ShippingBanner'
import { Footer } from '@/components/layout/Footer'
import { MobileMenu } from '@/components/layout/MobileMenu'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { InstagramButton } from '@/components/ui/InstagramButton'
import { TikTokButton } from '@/components/ui/TikTokButton'
import { CartDrawer } from '@/components/carrito/CartDrawer'
import { PageTransition } from '@/components/layout/PageTransition'
import { CustomCursor } from '@/components/ui/CustomCursor'
import { CookieBanner } from '@/components/ui/CookieBanner'

const Layout = () => {
  return (
    <>
      <ShippingBanner />
      <Header />
      <main>
        <PageTransition />
      </main>
      <Footer />
      <MobileMenu />
      <WhatsAppButton />
      <InstagramButton />
      <TikTokButton />
      <CartDrawer />
      <CustomCursor />
      <CookieBanner />
    </>
  )
}

export default Layout
