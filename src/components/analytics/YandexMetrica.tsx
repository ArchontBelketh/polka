import Script from "next/script"
import { MetricaRouteTracker } from "./MetricaRouteTracker"

// Яндекс.Метрика. Подключается только если задан NEXT_PUBLIC_YANDEX_METRICA_ID
// (на локалке пусто → счётчик не грузится и не портит статистику).
const METRICA_ID = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID

export function YandexMetrica() {
  if (!METRICA_ID) return null
  const id = METRICA_ID

  return (
    <>
      <Script id="yandex-metrica" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<e.scripts.length;j++){if(e.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${id}','ym');ym(${id},'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",accurateTrackBounce:true,trackLinks:true});`}
      </Script>
      <noscript>
        <div>
          <img src={`https://mc.yandex.ru/watch/${id}`} style={{ position: "absolute", left: "-9999px" }} alt="" />
        </div>
      </noscript>
      <MetricaRouteTracker id={Number(id)} />
    </>
  )
}
