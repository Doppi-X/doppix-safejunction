# Do'ppiX SafeJunction — jamoa uchun to'liq brifing

> Bu hujjatni o'qigan har bir a'zo loyihani boshidan oxirigacha tushuntira oladi, demoni o'tkaza oladi va hakamlarning texnik savollariga javob bera oladi. Hakamlar **istalgan a'zodan**, jumladan AI bilan yozilgan kod haqida ham so'rashi mumkin.

**Havolalar**
- **Sayt (prototip):** https://giyos1212-safejunction.static.hf.space
- **Kod:** https://github.com/ubaydullayevgiyosiddin7-eng/doppix-safejunction
- **Taqdimot:** `docs/DoppiX_SafeJunction_deck.pdf`
- **Nutq:** `docs/NUTQ_7daqiqa.md`
- **Zaxira demo:** `docs/demo_backup.mp4`

---

## 0. Bir daqiqada

**SafeJunction shahardagi mavjud yo'l kameralarini yo'l xavfsizligi auditoriga aylantiradi.**

- **Nima topadi:** qizil chiroqda o'tish, piyodaga yo'l bermaslik, qarama-qarshi harakat, xavfli yaqinlashuvlar (PET).
- **Nima qaytaradi:** ular kadrning qayerida bo'lganini ko'rsatadi, kameralarni xavf bo'yicha tartiblaydi va muhandisga "nimani o'zgartirish kerak" deb aytadi.
- **Maxfiylik:** yuz va raqamlar serverda xiralashtiriladi.

| | |
|---|---|
| **Rejim** | **Startup**: o'z mijozlari va daromadi bor mustaqil mahsulot |
| **Track** | Computer Vision → Driver & road safety (elimination'dagi traffic events vazifasining davomi) |
| **Foydalanuvchi** | Tuman yo'l harakati muhandisi |
| **To'lovchi** | Shahar yo'l xavfsizligi budjeti (kamera boshiga obuna). Ikkinchi to'lovchi: sug'urta kompaniyalari |
| **Narx** | Kamera boshiga oyiga 40 $ (faraz). Infratuzilma ~13 $, marja 68% |
| **Pilot** | 3 oy, 8 kamera, 3 chorraha, 12,400 $ |

---

## 1. Hakaton talablari va biz ularni qanday bajardik

### 1.1 Topshiriladigan narsalar

| Talab | Holat | Qayerda |
|---|---|---|
| **Prototype:** public https, jonli, hakam bergan input'da ham ishlaydi | ✅ Istalgan video yoki rasm yuklanadi. Namuna videoni bir bosishda ishga tushirsa bo'ladi. Telefonda ham ishlaydi | sayt → **Try it** |
| **Deck:** PDF/PPTX, ≤ 50 MB | ✅ PDF, 10 slayd | `docs/DoppiX_SafeJunction_deck.pdf` |
| **Repository:** kod, ishga tushirish README, data manbalari va litsenziyalar | ✅ | GitHub, README → "Data and licences" |
| **Deploy:** topshirilgan repodan frontend VA backend, GitHub Actions orqali (deploy tarixi) | ✅ Self-hosted runner GPU serverda, har push = deploy | GitHub → **Actions** |
| **Zaxira demo video** | ✅ 2 daqiqa | `docs/demo_backup.mp4` |

### 1.2 Muhandislik talabi (task'da alohida so'ralgan)

| So'ralgan | Javobimiz | Qanday bilamiz |
|---|---|---|
| **Inference qayerda** | Shahar video arxivi yonidagi GPU serverda (on-premise). Bizda bitta RTX 3060 12 GB. Brauzer faqat yuklaydi va ko'radi, hech qanday bulutli AI API chaqirilmaydi | o'lchangan |
| **O'z apparatimizdagi tezlik** | Aniqlash + kuzatish 10 fps'da **real vaqtdan 2× tez**. Rasm 0.5–0.7 s. 40 s video yuklashdan hisobotgacha ~50–60 s | o'lchangan |
| **Kamera boshiga narx** | Infratuzilma ~**13 $/oy**: server 1,200 $ / 36 oy / 4 kamera = 8.3 $, elektr 0.3 kW × 720 soat × 0.08 $ / 4 = 4.3 $ | hisob + farazlar |
| **Tunda** | Sintetik tunda: bizning model 0.39 → tungi model **0.92** (mAP50). Haqiqiy tungi dron videosida bizning model 6 kadrda 5 ta, umumiy COCO model 43 ta ishonchli obyekt topdi, shuning uchun model har kamera uchun avtomatik tanlanadi | sintetik test + haqiqiy video (labelsiz) |
| **Yomg'irda** | Sintetik yomg'ir 0.79 → **0.97**, tuman 0.97, xiralik 0.71 → 0.96. Haqiqiy yomg'ir (Times Square, Shenzhen, Tehron) va qor (Ottava) videolarida sinaldi | sintetik + haqiqiy (labelsiz) |
| **Mahalliy avtomobillar** | Toshkent chorrahasida o'zimiz labellagan **12,990 box**: Cobalt, Damas, bo'g'inli avtobuslar, bizning svetoforlar | o'lchangan |
| **Mahalliy raqamlar** | Raqamlarni **o'qimaymiz**, faqat xiralashtiramiz (maxfiylik). Ochiq raqam detektori har bir mashina boxi ichida ishlaydi | — |

### 1.3 Baholash mezonlari va bizning dalillarimiz

| Mezon (vazn) | Hakam nimani qidiradi | Bizning javobimiz |
|---|---|---|
| **Technical complexity (25%)** | Tizimmi yoki bitta model chaqiruvimi? O'z test to'plamida o'lchanganmi? Tezlik va narx? Xato holatlar? | 8 bosqichli pipeline (4-bo'lim). O'zimiz labellagan test to'plamlari. Tezlik va narx o'lchangan. Zaif joylar ochiq yozilgan |
| **Innovation (25%)** | Nima yangi? Boshqa jamoa bir dam olish kunida qayta qura oladimi? | O'z datamiz (12,990 box), o'z labellash dasturimiz. Yo'l va yo'nalishni transportdan o'rganish (leave-one-out). PET + Empirical Bayes. Har kamera uchun model tanlash. Ikki detektorli maxfiylik |
| **Impact (25%)** | Muammo realmi? Kim foydalanadi, kim to'laydi? 3 oyda pilot bo'ladimi? | 18 daqiqada soatiga 52 piyoda yo'lda, 29 yo'l bermaslik. Muhandis foydalanadi, shahar to'laydi. Pilot: mavjud kameralar, mavjud qonunlar doirasida |
| **Presentation (15%)** | Aniq hikoya, jonli demo, halol raqamlar | Nutq tayyor, zaxira video bor. Saytda har raqam yonida "measured / synthetic / assumption" yozuvi |
| **Business (10%)** | Budjet, ROI, unit economics, payback, farazlar | Saytda kalkulyator. Pilot 12,400 $, 110 kamerada o'zini qoplaydi, payback 2.4 oy. Hamma farazlar yozilgan |

### 1.4 Taqiqlar va biz

| Taqiq | Biz |
|---|---|
| Soxta demo, o'ylab topilgan metrika | Demo jonli. Har raqam o'lchangan, uning test to'plami va skripti repoda (`eval/`) |
| Rozilik bermagan odamlarning yuzi yoki raqami | Saytdagi **barcha** video va rasmlar xiralashtirilgan, foydalanuvchi videolari ham. Videolar 6 soatda o'chadi |
| Finaldan oldingi ishni finalda qilingan deb ko'rsatish | Saytda "Data & declaration" bo'limi, README jadvali. Git tarixida birinchi commit eski kodni o'zgarishsiz import qiladi |
| Attributionsiz kod yoki model | Barcha modellar, datalar va litsenziyalar sanab o'tilgan. AI yordamchi e'lon qilingan |

---

## 2. Muammo (hikoyaning boshi)

- Shahar xavfli chorrahani **avariyadan keyin**, statistika orqali biladi. Avariyagacha bo'lgan minglab xavfli holatlar hech qayerda yozilmaydi.
- **Dalilimiz:** bitta Toshkent chorrahasining 18.4 daqiqalik videosini o'zimiz hodisalar bo'yicha labelladik:

| Nima | Soni | Soatiga |
|---|---|---|
| Piyoda zebradan tashqarida yo'lda | 16 | **52** |
| Mashina piyodaga yo'l bermadi | 9 | **29** |
| Qizilda zebra ustida to'xtagan mashina | 6 | 20 |
| Qizil chiroqda o'tish | 2 | 7 |

- Hech kim jarohatlanmadi, shuning uchun bularning hech biri statistikaga tushmagan.
- Kameralar shaharda allaqachon bor, ularni xavf uchun hech kim tahlil qilmaydi. Biz yangi qurilma sotmaymiz.

---

## 3. Mahsulot: foydalanuvchi ko'zi bilan

1. **Try it:** video yoki rasm yuklanadi (kamera nomini yozsa bo'ladi). Videoning birinchi 2 daqiqasi ishlanadi.
2. Ishlanayotganda **ixtiyoriy** ravishda birinchi kadrda chiziladi:
   - **Road:** yo'l;
   - **Crosswalk:** zebra;
   - **Stop line:** stop-chiziq;
   - **Traffic light:** svetofor.

   Zonalar avtomatik saqlanadi.
3. **Natija:**
   - **Safety report:** hodisalar soni va vaqti, 5 daqiqadan uzun videoda soatiga nechta.
   - **Conflicts (PET):** jiddiy, o'rtacha va oddiy xavfli yaqinlashuvlar, 1000 piyodaga nisbatan.
   - **Hotspot map:** hodisa va xavfli holatlar kadrning qayerida bo'lgani.
   - **What to change:** tavsiyalar. Har biri o'zini keltirib chiqargan raqamni aytadi.
   - **Video:** boxlar va izlar, hodisa ishtirokchilari ramkada, yuz va raqamlar xira.
   - **PDF report** (muhandis uchun bir sahifa), **CSV, JSON**.
4. Zonani o'zgartirib, **bir necha soniyada qayta hisoblash** mumkin, video qayta ishlanmaydi.
5. **City dashboard:** har bir tahlil qilingan kamera reytingga tushadi.
   - **3 xil reyting:**
     - risk index;
     - 1000 piyodaga jiddiy holatlar;
     - Empirical Bayes.
   - **Before/after:** bitta kamerani o'zgarishdan oldin va keyin solishtirish.

**Uch xil sahna rejimi** (tizim o'zi tanlaydi):

| Rejim | Qachon | Nima topadi |
|---|---|---|
| **Zero-config** | Yangi kamera, zona chizilmagan | Qarama-qarshi harakat, to'xtab qolgan mashina, tirbandlik, xavfli yaqinlashuv, PET |
| **Zones drawn** | Foydalanuvchi zona chizgan | + qizilda o'tish, stop-chiziq, piyoda yo'lda, piyodaga yo'l bermaslik |
| **Known camera** | Bizning kalibrlangan chorraha | Hammasi; kamera siljigan bo'lsa ham o'zi moslashadi |

---

## 4. Texnologiya (chuqur, hakamlar uchun)

```
Video → [1] Model tanlash → [2] Aniqlash + kuzatish → [3] Sahna → [4] Hodisalar + PET
      → [5] Maxfiylik → [6] Hisobot → [7] Shahar dashboard'i
```

### [1] Har kamera uchun detektorni tanlash (`core/doppix/perception.py → choose_weights`)

- **Uchta nomzod bor:**
  - **bizning kunduzgi modelimiz** (Toshkent);
  - **bizning tungi modelimiz** (tun, yomg'ir va xiralik bilan qayta o'qitilgan);
  - **umumiy COCO modeli** (YOLO26m, millionlab rasmlarda o'qitilgan).
- **Qanday tanlanadi:** videodan 6 ta kadr olinadi. Har model ≥ 0.5 ishonch bilan nechta yo'l harakati ishtirokchisini topishi sanaladi. Kunduzgi modelimiz qoladi, agar boshqasi **1.25× + 2** martadan ko'proq topmasa. Qoidalar shu model uchun sozlangan.
- **Nega:** yangi videolar ko'rsatdi, bizning model bitta chorrahada o'qitilgani uchun dron yoki tungi ko'cha ko'rinishida deyarli hech narsa ko'rmaydi (tungi dron: 5 ta va 43 ta). Bizning chorrahada esa bizning model yaxshiroq (261 ta va 172 ta).
- **Avval sinab, voz kechganimiz:** yorug'lik bo'yicha tanlash. Ko'cha chirog'i ostidagi tun kunduzgi kadr bilan bir xil yorug'likda chiqdi (~90).

### [2] Aniqlash va kuzatish

- **YOLO26m:** Ultralytics'ning eng yangi detektori, "m" o'rta o'lcham.
  - COCO'da oldindan o'qitilgan, keyin **12,990 ta o'zimiz chizgan box** bilan 214 kadrda fine-tune qilingan.
  - **8 klass:** piyoda, velosiped, mashina, mototsikl, avtobus, yuk mashina, **svetofor qizil / qizil emas**.
  - Svetofor rangini rang filtri bilan emas, **detektor klassi** sifatida o'rgatdik. Kunduzgi quyosh nurida rang filtri ishlamadi.
- **ByteTrack:** har bir obyektga doimiy ID beradi. Past ishonchli boxlarni ham ikkinchi bosqichda bog'laydi, shuning uchun to'silgan obyekt yo'qolmaydi.
- **Kadr tezligi:** 4K video 1920 px'ga kichraytiriladi, har 3-kadr (~10 fps) imgsz 1280 da ishlanadi. GPU'da fp16 ishlatiladi.

### [3] Sahna

- **Chizilgan zonalar** (`Scene.from_zones`): yo'l, zebra, stop-chiziq, svetofor. Yo'l chizilmasa, transportdan o'rganilgan yo'l qo'shiladi.
- **Tanilgan kamera** (`align.py`): videoning fon kadri bizning chorraha bilan **ORB xususiyatlari + RANSAC** orqali solishtiriladi, kalibrlangan zonalar siljishga moslashtiriladi. Bir videoda kamera ~70 px siljigan edi, buni tuzatmasak svetofor 0% o'qilardi.
- **Zero-config** (`autoscene.py`): kadr 32 ustunli to'rga bo'linadi.
  - Har katakda harakatlanayotgan mashinalar yo'nalishi (birlik vektorlar yig'indisi) va izchilligi yig'iladi.
  - Mashinalar o'tadigan kataklar = **yo'l**; vektorlar = **har polosaning yo'nalishi**.

### [4] Hodisalar va xavfli holatlar

**Qoidalar** (`rules.py`, `generic.py`): 10 ta tushunarli qoida. Misollar:
- **Qizilda o'tish:** mashina oyoq nuqtasi stop-chiziqni kesgan paytda svetofor qizil (faza almashgandan keyingi 1 s e'tiborga olinmaydi).
- **Piyodaga yo'l bermaslik:** harakatdagi mashina zebrada, piyoda esa uning yo'lida (oldida, eni ichida).
- **Qarama-qarshi harakat:** mashina o'rganilgan yo'nalishga teskari (cos < −0.6) yurgan, kamida 2.5 s va 3 tana uzunligi.
  - **Leave-one-out:** tekshirishdan oldin mashinaning o'z izi maydondan olib tashlanadi. Shunda bitta teskari mashina tizimga "noto'g'ri yo'nalish"ni o'rgata olmaydi.

**Nega neyron tarmoq emas, qoidalar?**
- Har hodisa turi uchun bir necha o'nlab misol bor, neyron tarmoq o'rganishiga yetmaydi.
- Qoidani muhandis videoga qarab tekshira oladi va unga ishonadi.
- Har chegara bir joyda yozilgan (`config.py`, `rules.P`).

**PET** (`conflicts.py`, post-encroachment time): xalqaro standart o'lchov.
- **Ta'rif:** A biror nuqtani tark etdi, B shu nuqtaga necha soniyada keldi.
- **Darajalar** (Bellevue, AQSh, 75 chorraha tadqiqoti):
  - < 1.5 s jiddiy (haydovchi reaksiya vaqti);
  - 1.5–3 s o'rtacha;
  - 3–5 s oddiy.
- **Bizdagi amalga oshirish:**
  - kadr ~30 px kataklarga bo'linadi;
  - piyoda o'z oyoq katagini egallaydi, mashina esa boxining pastki 15% qismini (yerdagi izi);
  - **faqat yo'l kataklari** hisoblanadi;
  - ikkalasi ham harakatda bo'lishi kerak;
  - **mototsikl haydovchisi piyoda emas;**
  - mashina va mashina juftligi faqat yo'nalishlari 30° dan ko'p farq qilsa hisoblanadi, ya'ni bir-birining ortidan ketish hisoblanmaydi.
- **Ekspozitsiya:** yo'lga chiqqan piyoda va mashinalar soni → "1000 piyodaga jiddiy holatlar".

**Avariya xavfi (TTC)**, elimination'dan qolgan:
- har juftlik uchun oxirgi 1 s dan chiziqli prognoz qilinadi: eng yaqin kelish vaqti va masofasi;
- oddiy trafikning 99.9-persentili 0.45 ga kalibrlangan, signal chegarasi 0.5.

### [5] Maxfiylik (`privacy.py`)

- **Raqamlar:** ikki bosqichli. Avval mashina topiladi, keyin ochiq raqam detektori (YOLOv11, morsetechlab) **faqat mashina ichida** qidiradi. Kichik raqamlar butun kadrdagidan yaxshiroq topiladi.
- **Yuzlar:** har bir odam boxining yuqori 22% qismi xiralashtiriladi.
- **Ikkinchi detektor (finalda qo'shilgan):** bizning model kameraga yaqin turgan katta odamlarni o'tkazib yuborgan edi (Times Square). Endi har kadrda COCO modeli ham ishlaydi va **ikkalasi topgan hamma narsa** xiralashtiriladi. Maxfiylikda "ortiqcha bo'lsa ham, qolib ketmasin".
- Video serverdan chiqishidan oldin xiralashtiriladi, 6 soatda o'chiriladi. Dashboard faqat raqamlar va bitta xira kadrni saqlaydi.

### [6] Hisobot (`report.py`)

- Rasm va tavsiyalar **qat'iy qoidalar** asosida tuziladi, LLM ishlatilmaydi.
- Video 5 daqiqadan qisqa bo'lsa, soatlik ko'rsatkich hisoblanmaydi va bu ochiq yoziladi. Avval 15 soniyalik video "soatiga 238" degan ma'nosiz raqam chiqargan edi, shuni tuzatdik.

### [7] Shahar dashboard'i (`backend/app.py → /api/network`, `Network.jsx`)

- **Risk index:** og'irlikli "10 daqiqada hodisalar":
  - qizilda o'tish, qarama-qarshi harakat, yo'l bermaslik, xavfli yaqinlashuv ×3;
  - piyoda yo'lda ×2;
  - qolganlari ×1.
- **1000 piyodaga jiddiy PET holatlari.**
- **Empirical Bayes** (AQSh Highway Safety Manual):
  - kutilgan = w·bashorat + (1−w)·kuzatilgan;
  - w = 1/(1 + k·bashorat);
  - bashorat = shahar o'rtacha ko'rsatkichi × kamera piyodalari soni;
  - k = 0.5 (**faraz**);
  - reyting "ortiqcha kutilgan" bo'yicha. Qisqa yoki tinch video tasodifan birinchi o'ringa chiqmaydi.

### Infratuzilma

- **Backend:**
  - FastAPI, bitta GPU uchun bitta navbat;
  - video job, rasm, zonalar, natija va video uchun endpointlar;
  - Cloudflare tunnel orqali internetga chiqadi.
- **Frontend:** React + Vite + Tailwind. Hugging Face Static Space'da turadi. Server manzilini `data/api.json` dan oladi, uni GPU server o'zi yangilaydi.
- **Deploy:** GitHub Actions, self-hosted runner GPU kompyuterda:
  - server kodini commit'ga o'tkazadi;
  - xizmatni qayta ishga tushiradi;
  - saytni build qilib Hugging Face'ga chiqaradi;
  - smoke test qiladi.
- **Determinizm:** seed 42, test vaqtida tasodifiylik yo'q.

---

## 5. Raqamlar (hammasi o'lchangan, ma'nosi bilan)

| Nima | Test to'plami | Natija | Ma'nosi va ehtiyot |
|---|---|---|---|
| Detektor | O'qitishda ishlatilmagan 22 kadr, 1,386 box | **mAP50 0.978**, mAP50-95 0.885 | 1 ga yaqin = juda yaxshi. Bitta chorrahada |
| Hodisa qoidalari | 4 video, 18 min, bizning labellar | **Score A 0.83** | Rasmiy metrika: 6 klass bo'yicha o'rtacha F1 (tIoU 0.3/0.5/0.7). Optimistik, chunki qoidalar shu videolarda sozlangan |
| Klasslar bo'yicha | o'sha | qizilda o'tish 1.00, stop-chiziq 0.92, tirbandlik 0.90, to'xtagan 0.81, piyoda yo'lda 0.70, yo'l bermaslik 0.64 | Eng zaifi "yo'l bermaslik" |
| Qarama-qarshi harakat | 18 min real trafik | **0 ta yolg'on signal / soat** | Avval soatiga 55 ta edi, chegaralarni sozladik |
| Qarama-qarshi harakat | 60 ta haqiqiy mashina izi teskari aylantirildi | **93% topildi** (56/60) | Sintetik test, ochiq aytamiz |
| Zonasiz to'xtagan / tirbandlik | bizning labellar | F1 0.0–0.67 | **Zaif:** qizildagi navbatni tirbandlik deb o'ylaydi. Stop-chiziq chizilsa tuzaladi |
| Tungi model kunduzda | o'sha 4 video | 0.77 (kunduzgi 0.83) | Shuning uchun kamera bo'yicha model tanlash |
| PET | 9 ta labellangan "yo'l bermaslik" | **7/9** da PET < 3 s | PET uchun tayyor "to'g'ri javob" yo'q. 12 ta jiddiy holatni ko'z bilan tekshirdik: 11 tasi haqiqiy |
| Tezlik | RTX 3060 | 2× real vaqt, rasm 0.5–0.7 s | |
| Sig'im | 5 fps'da aniqlik tushmaydi (0.828 → 0.827) | **1 GPU ≈ 4 kamera** | |

**Ob-havo (detektor mAP50, sintetik buzilishlar):**

| | Kun | Tuman | Past sifat | Yomg'ir | Xiralik | **Tun** |
|---|---|---|---|---|---|---|
| Kunduzgi model | **0.975** | **0.971** | **0.881** | 0.793 | 0.712 | 0.390 |
| Tungi model | 0.978 | 0.976 | 0.857 | **0.967** | **0.959** | **0.916** |

- **Nima ishlamadi:** kadrni yorqinlashtirish (gamma + CLAHE) tunni **yomonlashtirdi**: 0.39 → 0.27.
- **Ehtiyot:** tungi model qanday sun'iy tunda o'qitilgan bo'lsa, xuddi shunday sun'iy tunda sinaldi. Hozir jamoa **haqiqiy tungi kadrlarni labellayapti**. Natija kelgach, haqiqiy tun aniqligi qo'shiladi.

**Boshqa shaharlardagi 7 kamera** (labelsiz, faqat tizim nima qilgani ko'rsatiladi):

| Kamera | Tanlangan model | Jiddiy / o'rtacha PET | Izoh |
|---|---|---|---|
| Shibuya, Tokio | bizniki | 9 / 10 | Olomon va mashinalar |
| Times Square, yomg'irli tun | bizniki | 3 / 3 | |
| Tungi dron | COCO | 1 / 5 | 226 mashina, tirbandlik |
| Nyu-York kunduz | COCO | 0 / 0 | Tirbandlik |
| Ottava, qor | COCO | 0 / 0 | Kam transport |
| Kunduzgi dron (tik tepadan) | bizniki | 0 / 0 | **Zaif:** ikkala model ham tepadan yaxshi ko'rmaydi |
| Tungi ko'cha | bizniki | 0 / 0 | Kam obyekt topildi |

---

## 6. Zaif tomonlar (o'zimiz aytamiz, bu ishonch beradi)

1. **Haqiqiy tunda** hali label bilan o'lchanmagan. Hozir labellayapmiz.
2. **Qisqa videoda zonasiz** hodisalar kam topiladi. Yo'nalishni o'rganish uchun trafik kerak. Yechim: zona chizish (2 daqiqa) yoki uzunroq video.
3. **Tik tepadan dron ko'rinishi** zaif.
4. **PET tasvir tekisligida** hisoblanadi, shuning uchun mashina orqasidagi piyoda yolg'on holat berishi mumkin. Keyingi qadam: 4 nuqtali homografiya (metrga o'tish).
5. **Yangi kamerada svetofor rangi** tasdiqlanmagan. Bizning svetofor klasslari faqat Toshkent svetoforlarida o'qitilgan.
6. **Avariya xavfi** haqiqiy avariyalarda sinalmagan, namunalarda avariya yo'q.
7. **Olomonda tracker ID almashadi**, shuning uchun "piyoda izlari" odamlar sonidan ko'p chiqadi.

---

## 7. Finalgacha va finalda (qoida bo'yicha muhim)

| Finalgacha (elimination) | Finalda (10–11 oktabr) |
|---|---|
| YOLO26m, 12,990 box, labellash dasturi | Zero-config: yo'l va yo'nalishni transportdan o'rganish |
| ByteTrack, kamera siljishini tuzatish | Istalgan kamera uchun qoidalar (leave-one-out) |
| Bitta chorraha uchun zona qoidalari | Brauzerda zona chizish |
| Avariya xavfi (TTC) | Maxfiylik: raqam va yuz, ikki detektor |
| Elimination sayti | Yangi API va sayt, hisobot, xavf xaritasi, PDF |
| | PET va 1000 piyodaga nisbat |
| | Shahar dashboard'i, Empirical Bayes, oldin/keyin |
| | Tungi model, ob-havo testlari, kamera bo'yicha model tanlash |
| | Boshqa shaharlardan 14 ta ochiq video bilan sinov va labellash |
| | Biznes modeli, CI/CD (GitHub Actions) |

---

## 8. Biznes

**Kamera boshiga oylik:**

| Qator | Summa | Izoh |
|---|---|---|
| Narx | 40 $ | faraz |
| Server | 1,200 $ / 36 oy / 4 kamera = 8.3 $ | |
| Elektr | 0.3 kW × 720 soat × 0.08 $ / 4 = 4.3 $ | |
| **Marja** | **27.3 $ (68%)** | |

- **Doimiy xarajat:** jamoa 3 × 900 $ + 300 $ = 3,000 $/oy.
- **Natija:**
  - **110 kamerada o'zini qoplaydi**;
  - 300 kamerada oyiga ~5,200 $ foyda;
  - pilot xarajati **2.4 oyda** qaytadi.
- **Pilot, 3 oy, 12,400 $:**
  - jamoa 8,100 $;
  - 2 server 2,400 $;
  - labellash 1,500 $;
  - elektr va hosting 400 $;
  - litsenziya 0 $ (AGPL ochiq kod).
- **Litsenziya ogohlantirishi:** yopiq tijorat versiyasi uchun Ultralytics Enterprise litsenziyasi yoki boshqa detektorga o'tish kerak. Saytda ham yozilgan.

**Pilot rejasi:**
1. **1-oy:** 8 kamerani shahar serveriga ulash, tungi va yomg'irli video yig'ish.
2. **2-oy:** labellash va qayta o'qitish.
3. **3-oy:** bitta o'zgarishni o'lchash, masalan piyodaga 3–5 s oldin yashil berish. Oldin va keyin "1000 piyodaga jiddiy holatlar".

**Bozor va raqobatchilar:**
- **Miovision:** bitta chorrahani tekshirish (48–60 soat video) ~**8,000 $**, qurilma 6,795 $.
- **Vivacity** (Angliya): sensor boshiga yiliga ~650 £.
- **Transoft/Brisk, Derq:** loyihaviy narx, AQShda federal SS4A grantlari bilan.
- **Biz:** kamera boshiga yiliga 480 $, shahar kamerasida, doimiy.
- Bellevue (AQSh) yorqin zebra bo'yagach, piyoda bilan bog'liq xavfli holatlar **56%** kamaygan. Bu bizning before/after funksiyamizning aynan o'zi.
- **Sug'urtachilar:** Kanadada Aviva va Avstraliyada Queensland majburiy sug'urta regulyatori (MAIC) shunday tadqiqotlarni moliyalashtirgan. O'zbekistonda **majburiy avtosug'urta kompaniyalari** tabiiy hamkor.

---

## 9. Kelajak (yo'l xaritasi)

**Yaqin (1–3 oy, pilot ichida):**
- **Haqiqiy tun va yomg'ir** datasini labellab, modelni qayta o'qitish (bugun boshladik).
- **4 nuqtali homografiya:** foydalanuvchi zebra yoki polosa burchaklarini bosadi, tizim **metrda** ishlaydi. Shunda **tezlik** (85-persentil, tezlik oshirish ulushi) va aniqroq PET olinadi.
- **Jonli RTSP oqim:** video yuklash o'rniga kameraga to'g'ridan-to'g'ri ulanish va 24/7 ishlash.
- **Har kamera uchun avtomatik kalibrlash:** svetofor rangi yangi kamerada ham.

**O'rta (3–12 oy):**
- Toshkentning bir tumanida 50–100 kamera va shahar dashboard'i.
- **Sug'urta mahsuloti:** chorrahalar bo'yicha xavf statistikasi.
- **Avtodilerlar va fleet uchun:** haydovchilarning xavfli manevrlari statistikasi. Hamkorlar Toyota, BYD, Ducati, ya'ni mototsiklchilar xavfsizligi.
- Ultralytics Enterprise litsenziyasi yoki ochiq litsenziyali detektorga o'tish.

**Uzoq:**
- **Edge qurilmalar** (Jetson): kamera yonida ishlash, video umuman serverga chiqmaydi.
- Butun shahar bo'yicha "xavf xaritasi" va svetofor sozlamalarini avtomatik tavsiya qilish.
- Qo'shni shaharlar: Almati, Bishkek, Dushanbe (o'xshash mashinalar).

---

## 10. Demo (2 daqiqa) va zaxira

**Oldindan:** sayt noutbukda ochiq, 40 s video tayyor, zaxira video `docs/demo_backup.mp4` qo'l ostida.

1. QR kodni ko'rsating: "telefoningizda sinab ko'ring" (sayt → Overview bo'limi).
2. **Try it** → video yuklang yoki **"Run our 40 s sample clip"** ni bosing.
3. Ishlanayotganda zebra va stop-chiziqni chizing (10 s): "yangi kamera 2 daqiqada ulanadi".
4. Natijada ko'rsating:
   - Safety report → **Conflicts (PET)** → **Hotspot map** → **PDF report**;
   - videoda xira yuzlar.
5. **City dashboard** → kamera reytingda paydo bo'lgan. "Rank by: Empirical Bayes" ni tanlang va Before/After ni ko'rsating.
6. Hakam video bersa, darhol yuklang.

**Internet yoki server ishlamasa:** zaxira videoni qo'ying va "bu jonli saytdan yozib olingan" deb ayting. Texnik muammo vaqtni to'xtatmaydi.

---

## 11. Hakamlar savollari va javoblar

**Umumiy**
- **"Bu ChatGPT chaqiruvimi?"** — Yo'q. Ishlash paytida hech qanday LLM yoki pullik API yo'q. O'zimiz o'qitgan detektor, kuzatuvchi, qoidalar va xalqaro xavfsizlik o'lchovlari.
- **"Kod AI bilan yozilganmi?"** — Ha, AI yordamchi bilan, README'da e'lon qilingan. Arxitektura, data, qarorlar va o'lchovlar bizniki. Istalgan faylni tushuntira olamiz:
  - `conflicts.py` — PET;
  - `autoscene.py` — yo'nalishni o'rganish;
  - `perception.py` — model tanlash;
  - `privacy.py` — xiralashtirish.
- **"Boshqa jamoa buni bir dam olish kunida qila oladimi?"** — Yo'q:
  1. o'zimiz labellagan 12,990 box va o'z labellash dasturimiz;
  2. labellangan test to'plamida o'lchangan qoidalar;
  3. leave-one-out yo'nalish o'rganish;
  4. PET + Empirical Bayes;
  5. 14 ta boshqa shahar videosi bilan sinov va hozir ketayotgan haqiqiy tungi labellash.

**Texnik**
- **"mAP50 nima?"** — Detektor topgan box haqiqiy box bilan kamida 50% ustma-ust tushsa, to'g'ri hisoblanadi. mAP = barcha klasslar bo'yicha o'rtacha aniqlik, 1 eng yaxshi.
- **"Score A nima?"** — Elimination'dagi rasmiy metrika: hodisa vaqt oralig'i bo'yicha F1, uch xil ustma-ustlik chegarasida (0.3/0.5/0.7) o'rtacha olingan.
- **"Nega YOLO26m?"** — Tez (RTX 3060'da real vaqtdan 2× tez) va aniq, o'rta o'lcham GPU xotirasiga sig'adi. Ultralytics bilan oson o'qitiladi.
- **"Overfitting bo'lmadimi?"** — Detektor o'qitishda ishlatilmagan kadrlarda sinalgan. Qoidalarning 0.83 bahosi optimistik ekanini o'zimiz aytamiz. Shuning uchun boshqa shahar videolarida ham sinadik va hozir haqiqiy tungi test to'plamini qilyapmiz.
- **"Kamera siljisa-chi?"** — Tanilgan kamerada ORB + RANSAC bilan avtomatik moslashadi. Yangi kamerada yo'l transportdan qayta o'rganiladi.
- **"PET qanchalik ishonchli?"** — 9 ta labellangan "yo'l bermaslik"dan 7 tasini topdi, 12 tadan 11 tasi ko'z bilan tasdiqlandi. Tasvir tekisligida ishlaydi, metrga o'tish (homografiya) keyingi qadam.
- **"Tunda ishlaydimi?"** — Sintetik tunda 0.39 dan 0.92 ga ko'tardik. Har kamera uchun model avtomatik tanlanadi. Haqiqiy tungi kadrlarni hozir labellayapmiz.
- **"Narx qayerdan?"** — Tezlik o'lchangan (1 GPU = 4 kamera). Server, elektr va maosh farazlari saytdagi kalkulyatorda, istalganini o'zgartirib ko'rsa bo'ladi.
- **"Deploy tarixini ko'rsating."** — GitHub → Actions. Har push GPU serverga va saytga deploy qiladi, smoke test bilan.

**Biznes va qonun**
- **"Kim to'laydi?"** — Shahar yo'l xavfsizligi budjeti (obuna) va sug'urtachilar.
- **"Shaxsiy ma'lumotlar-chi?"** — Video shahar serveridan chiqmaydi. Yuz va raqamlar xiralashtiriladi, raqamlar hech qachon o'qilmaydi. Faqat anonim hodisa metadatasi saqlanadi.
- **"3 oyda pilot real?"** — Ha. Mavjud kameralar, shahar ichidagi server, yangi qurilma yoki ruxsat kerak emas. Faqat video arxivga kirish.
- **"Raqobatchilardan farqingiz?"** — Bir martalik tekshiruvdan arzon va doimiy, AQSh kompaniyalari sotmaydigan shaharlar uchun on-premise, maxfiylik ichida, mahalliy transportda o'qitilgan.

---

## 12. Kim nima qiladi

| A'zo | Taqdimotda | Savollarda asosan |
|---|---|---|
| **Eldor Musayev** (kapitan, ML) | 1, 2, 5, 6, 7-slaydlar | Model, data, qoidalar, PET, raqamlar |
| **Shohruh Gulmirodov** (web) | 3, 4-slaydlar, **jonli demo** | Sayt, API, deploy, dashboard |
| **Ibodulla Obidjonov** (kiberxavfsizlik) | 8, 9, 10-slaydlar | Biznes, pilot, **maxfiylik va xavfsizlik** |

---

## 13. Atamalar lug'ati

- **Detektor:** rasmda obyektlarni topib, box chizadigan model (YOLO).
- **Tracker (ByteTrack):** bir obyektni kadrdan kadrga kuzatib, unga doimiy ID beradigan algoritm.
- **mAP50 / mAP50-95:** detektor aniqligi; 50% yoki 50–95% ustma-ustlikda o'rtacha aniqlik.
- **F1:** aniqlik (precision) va to'liqlik (recall) muvozanati, 0–1.
- **tIoU:** vaqt oraliqlarining ustma-ustligi (hodisa qachon boshlanib tugagani).
- **PET (post-encroachment time):** biri ketgandan keyin ikkinchisi o'sha joyga necha soniyada keldi. < 1.5 s jiddiy.
- **TTC (time-to-collision):** hozirgi tezlikda necha soniyada to'qnashadi.
- **Ekspozitsiya:** xavfga duch kelganlar soni (masalan yo'lga chiqqan piyodalar); nisbatlar shunga bo'linadi.
- **Empirical Bayes:** kam data bo'lgan joyni shahar o'rtachasiga "tortib", tasodifiy shovqinni kamaytiradigan reyting usuli (Highway Safety Manual).
- **Zero-config:** zonasiz, sozlamasiz ishlash.
- **Leave-one-out:** tekshirilayotgan mashinaning o'z ma'lumoti chiqarib tashlangan holda tekshirish.
- **Homografiya:** kamera kadridagi nuqtalarni yerdagi metr koordinatalariga o'tkazish.
- **On-premise:** mijozning o'z serverida, bulutsiz.
- **Fine-tune:** tayyor modelni o'z datamiz bilan qo'shimcha o'qitish.
- **COCO:** 80 klassli mashhur ochiq dataset; "COCO model" = shunda o'qitilgan umumiy model.
- **AGPL-3.0:** ochiq kod litsenziyasi. Tarmoq orqali xizmat ko'rsatilsa, kod ochiq bo'lishi kerak.
- **CI/CD (GitHub Actions):** har kod yuklanganda avtomatik build va deploy.
