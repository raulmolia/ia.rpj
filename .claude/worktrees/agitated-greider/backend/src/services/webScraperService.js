// Servicio de scraping y extracción de contenido web
// Soporta páginas individuales, dominios completos y sitemaps

import * as cheerio from 'cheerio';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; RPJ-Pastoral-Bot/1.0; +https://ia.rpj.es)';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_PAGES_PER_DOMAIN = parseInt(process.env.WEB_SCRAPER_MAX_PAGES || '50', 10);
const MAX_CONTENT_SIZE = parseInt(process.env.WEB_SCRAPER_MAX_SIZE || '5242880', 10); // 5MB

class WebScraperService {
    constructor() {
        this.userAgent = process.env.WEB_SCRAPER_USER_AGENT || DEFAULT_USER_AGENT;
        this.timeout = parseInt(process.env.WEB_SCRAPER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS, 10);
    }

    /**
     * Extrae el dominio de una URL
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            throw new Error(`URL inválida: ${url}`);
        }
    }

    /**
     * Normaliza una URL
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remover fragmentos y ordenar parámetros
            urlObj.hash = '';
            return urlObj.toString();
        } catch (error) {
            throw new Error(`URL inválida: ${url}`);
        }
    }

    /**
     * Descarga el contenido HTML de una URL
     */
    async fetchUrl(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                },
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
                throw new Error(`Tipo de contenido no soportado: ${contentType}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            if (contentLength > MAX_CONTENT_SIZE) {
                throw new Error(`Contenido demasiado grande: ${contentLength} bytes`);
            }

            const html = await response.text();
            return html;
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                throw new Error(`Timeout al descargar ${url}`);
            }
            throw error;
        }
    }

    /**
     * Extrae texto limpio de HTML
     */
    extractTextFromHtml(html, url) {
        const $ = cheerio.load(html);

        // Remover scripts, estilos y elementos no deseados
        $('script, style, nav, header, footer, aside, iframe, noscript').remove();

        // Extraer título
        const title = $('title').text().trim() || 
                     $('h1').first().text().trim() || 
                     $('meta[property="og:title"]').attr('content') || 
                     '';

        // Extraer descripción
        const description = $('meta[name="description"]').attr('content') ||
                          $('meta[property="og:description"]').attr('content') ||
                          '';

        // Extraer contenido principal
        let mainContent = '';

        // Intentar encontrar el contenido principal
        const mainSelectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '.main-content',
            '#content',
            '#main',
        ];

        for (const selector of mainSelectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                mainContent = element.text();
                break;
            }
        }

        // Si no se encuentra contenido principal, usar el body
        if (!mainContent) {
            mainContent = $('body').text();
        }

        // Limpiar el texto
        const cleanText = mainContent
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();

        return {
            url: url,
            title: title,
            description: description,
            content: cleanText,
            wordCount: cleanText.split(/\s+/).length,
        };
    }

    /**
     * Extrae enlaces de una página
     */
    extractLinks(html, baseUrl) {
        const $ = cheerio.load(html);
        const links = new Set();

        $('a[href]').each((_, element) => {
            try {
                const href = $(element).attr('href');
                if (!href) return;

                // Resolver URL relativas
                const absoluteUrl = new URL(href, baseUrl).toString();
                
                // Solo incluir enlaces del mismo dominio
                const baseDomain = new URL(baseUrl).hostname;
                const linkDomain = new URL(absoluteUrl).hostname;
                
                if (linkDomain === baseDomain) {
                    links.add(this.normalizeUrl(absoluteUrl));
                }
            } catch (error) {
                // Ignorar enlaces inválidos
            }
        });

        return Array.from(links);
    }

    /**
     * Procesa una página individual
     */
    async scrapePage(url) {
        try {
            console.log(`🌐 Scraping página: ${url}`);
            
            const html = await this.fetchUrl(url);
            const extracted = this.extractTextFromHtml(html, url);
            
            return {
                success: true,
                url: url,
                title: extracted.title,
                description: extracted.description,
                content: extracted.content,
                wordCount: extracted.wordCount,
            };
        } catch (error) {
            console.error(`❌ Error scraping ${url}:`, error.message);
            return {
                success: false,
                url: url,
                error: error.message,
            };
        }
    }

    /**
     * Procesa un dominio completo (con límite de páginas)
     */
    async scrapeDomain(startUrl, maxPages = MAX_PAGES_PER_DOMAIN) {
        const visited = new Set();
        const toVisit = [this.normalizeUrl(startUrl)];
        const results = [];
        const baseDomain = this.extractDomain(startUrl);

        console.log(`🌐 Iniciando scraping de dominio: ${baseDomain} (máx ${maxPages} páginas)`);

        while (toVisit.length > 0 && visited.size < maxPages) {
            const url = toVisit.shift();
            
            if (visited.has(url)) continue;
            visited.add(url);

            try {
                const html = await this.fetchUrl(url);
                const extracted = this.extractTextFromHtml(html, url);
                
                results.push({
                    success: true,
                    url: url,
                    title: extracted.title,
                    description: extracted.description,
                    content: extracted.content,
                    wordCount: extracted.wordCount,
                });

                // Extraer enlaces solo si no hemos alcanzado el límite
                if (visited.size < maxPages) {
                    const links = this.extractLinks(html, url);
                    for (const link of links) {
                        if (!visited.has(link) && !toVisit.includes(link)) {
                            toVisit.push(link);
                        }
                    }
                }

                // Pequeña pausa para no sobrecargar el servidor
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ Error scraping ${url}:`, error.message);
                results.push({
                    success: false,
                    url: url,
                    error: error.message,
                });
            }
        }

        console.log(`✅ Scraping completado: ${results.filter(r => r.success).length}/${results.length} páginas exitosas`);

        return {
            domain: baseDomain,
            totalPages: results.length,
            successfulPages: results.filter(r => r.success).length,
            pages: results,
        };
    }

    /**
     * Procesa un sitemap XML
     */
    async scrapeSitemap(sitemapUrl, maxPages = MAX_PAGES_PER_DOMAIN) {
        console.log(`🗺️  Procesando sitemap: ${sitemapUrl}`);

        try {
            const html = await this.fetchUrl(sitemapUrl);
            const $ = cheerio.load(html, { xmlMode: true });

            const urls = [];
            $('url > loc').each((_, element) => {
                const url = $(element).text().trim();
                if (url) urls.push(url);
            });

            if (urls.length === 0) {
                throw new Error('No se encontraron URLs en el sitemap');
            }

            console.log(`📋 Encontradas ${urls.length} URLs en el sitemap`);

            const urlsToProcess = urls.slice(0, maxPages);
            const results = [];

            for (const url of urlsToProcess) {
                const result = await this.scrapePage(url);
                results.push(result);

                // Pequeña pausa entre páginas
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return {
                sitemap: sitemapUrl,
                totalUrls: urls.length,
                processedUrls: results.length,
                successfulPages: results.filter(r => r.success).length,
                pages: results,
            };

        } catch (error) {
            throw new Error(`Error procesando sitemap: ${error.message}`);
        }
    }
}

// Exportar instancia singleton
const webScraperService = new WebScraperService();
export default webScraperService;
