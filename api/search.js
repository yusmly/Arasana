// ARASANA arama API'si
// Bu dosya sunucu tarafında çalışır, API anahtarı tarayıcıya asla gönderilmez.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Sadece POST istekleri kabul edilir' });
  }

  const { query } = req.body || {};
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'query alanı gerekli' });
  }

  const systemPrompt = `Sen ARASANA adlı bir arama motorunun arka planısın. Kullanıcının sorgusu için web'de gerçek zamanlı arama yap, güvenilir kaynaklardan bilgi topla.

Aramanı tamamladıktan sonra SADECE ve SADECE aşağıdaki formatta geçerli bir JSON nesnesi döndür. Başka hiçbir açıklama, markdown işareti veya ek metin ekleme:

{
  "answer": "Kullanıcının sorusuna Türkçe, net, 2-4 cümlelik en faydalı doğrudan cevap",
  "results": [
    {"title": "Kaynağın gerçek sayfa başlığı", "url": "https://tam-url", "snippet": "O kaynaktan 1-2 cümlelik özet"},
    ... (arama sonucunda bulduğun gerçek kaynaklardan 5-7 tane)
  ]
}

Kurallar:
- title ve url alanları gerçek arama sonuçlarından gelmeli, uydurma.
- answer alanı kısa, öz ve doğrudan olmalı, gereksiz laf kalabalığı yapma.
- SIRALAMA ÇOK ÖNEMLİ: Eğer sorgu bir marka, ürün, şirket veya web sitesi adıysa (ör. "youtube", "twitter", "trendyol"), o markanın RESMİ web sitesi results dizisinin KESİNLİKLE İLK sırasında olmalı. Haber siteleri, wikipedia, bloglar, üçüncü taraf yorumlar veya alakasız/eski/düşük kaliteli kaynaklar asla resmi siteden önce gelmemeli.
- Genel bilgi sorgularında da en güvenilir, en alakalı ve en yetkili kaynağı (resmi kurum, birincil kaynak) üstte tut; gereksiz doldurma veya alakasız sonuçları listeye ekleme.
- results dizisini alaka düzeyine göre azalan sırada ver.
- JSON dışında hiçbir şey yazma.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Anthropic API hatası' });
    }

    let fullText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    let cleaned = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('ARASANA API hata:', err);
    return res.status(500).json({ error: 'Arama sırasında bir hata oluştu' });
  }
}
