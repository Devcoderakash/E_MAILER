export interface DeliverabilityIssue {
  category: "subject" | "content" | "links" | "structure" | "sender";
  severity: "critical" | "warning" | "info";
  rule: string;
  message: string;
  recommendation: string;
}

export interface ContentScanResult {
  score: number; // 0 to 100
  grade: "OPTIMAL" | "GOOD" | "NEEDS_ATTENTION";
  summary: string;
  issues: DeliverabilityIssue[];
  metrics: {
    subjectLength: number;
    wordCount: number;
    linkCount: number;
    imageCount: number;
    spamTriggerCount: number;
    hasHttpsLinksOnly: boolean;
    hasUnsubscribeLink: boolean;
    hasPersonalizationTag: boolean;
    hasPlainTextAlternative: boolean;
    isSenderAligned: boolean;
  };
}

export class ContentDeliverabilityScanner {
  // High-risk spam phrases heavily penalized by Gmail inbound filters
  private static readonly HIGH_RISK_SPAM_WORDS = [
    "100% free",
    "make money fast",
    "risk free",
    "earn cash",
    "crypto profits",
    "guaranteed returns",
    "no catch",
    "wire transfer",
    "financial freedom",
    "no investment",
    "billionaire",
    "lottery winner",
    "claim your prize",
    "double your income",
    "pure profit",
    "viagra",
    "casino",
    "get rich",
    "online pharmacy",
    "unclaimed funds",
  ];

  // Moderate-risk promotional phrases that increase commercial classification in Gmail
  private static readonly PROMOTIONAL_TRIGGER_WORDS = [
    "order now",
    "buy direct",
    "exclusive deal",
    "special promotion",
    "clearance sale",
    "act immediately",
    "hurry up",
    "don't hesitate",
    "limited time offer",
    "urgent notice",
    "congratulations",
    "lowest price",
    "best rates",
    "call now",
    "instant access",
    "save big",
  ];

  // Public URL shorteners that trigger Google spam filter penalties for personal Gmail senders
  private static readonly URL_SHORTENERS = [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "goo.gl",
    "cutt.ly",
    "shorturl.at",
  ];

  /**
   * Scan campaign content, subject line, links, and structure for deliverability risks.
   */
  public static scan(input: {
    subject: string;
    htmlContent: string;
    preheader?: string | null;
    fromEmail?: string;
    authenticatedGmailUser?: string;
  }): ContentScanResult {
    const issues: DeliverabilityIssue[] = [];
    let score = 100;

    const subject = input.subject ? input.subject.trim() : "";
    const html = input.htmlContent ? input.htmlContent : "";
    const lowerSubject = subject.toLowerCase();
    const lowerHtml = html.toLowerCase();
    const plainText = this.stripHtmlTags(html);
    const words = plainText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // ==========================================
    // 1. SUBJECT LINE CHECKS
    // ==========================================
    const subjectLength = subject.length;

    if (!subject) {
      score -= 30;
      issues.push({
        category: "subject",
        severity: "critical",
        rule: "SUBJECT_MISSING",
        message: "Subject line is completely empty.",
        recommendation: "Provide a descriptive, professional subject line.",
      });
    } else {
      // Fake Reply / Forward prefixes (Re:, Fwd:)
      if (/^(re:|fwd:|fw:)/i.test(subject)) {
        score -= 25;
        issues.push({
          category: "subject",
          severity: "critical",
          rule: "MISLEADING_SUBJECT_PREFIX",
          message: "Subject begins with deceptive prefix ('Re:' or 'Fwd:').",
          recommendation:
            "Remove 'Re:' or 'Fwd:'. Gmail spam algorithms heavily penalize cold broadcast emails that fake ongoing conversations.",
        });
      }

      // ALL CAPS in Subject
      const lettersInSubject = subject.replace(/[^a-zA-Z]/g, "");
      if (
        lettersInSubject.length > 6 &&
        lettersInSubject === lettersInSubject.toUpperCase()
      ) {
        score -= 15;
        issues.push({
          category: "subject",
          severity: "warning",
          rule: "ALL_CAPS_SUBJECT",
          message: "Subject line is written entirely in ALL CAPS.",
          recommendation: "Use standard title case or sentence case to avoid looking like aggressive spam.",
        });
      }

      // Excessive Punctuation (!!!, $$$, ???)
      if (/(!{2,}|\?{2,}|\${2,})/.test(subject)) {
        score -= 12;
        issues.push({
          category: "subject",
          severity: "warning",
          rule: "EXCESSIVE_PUNCTUATION",
          message: "Subject line contains multiple consecutive exclamation marks, dollar signs, or question marks.",
          recommendation: "Keep punctuation natural. Limit to at most one exclamation mark or question mark.",
        });
      }

      // Subject Length
      if (subjectLength < 10) {
        score -= 5;
        issues.push({
          category: "subject",
          severity: "info",
          rule: "SUBJECT_TOO_SHORT",
          message: "Subject line is very short (under 10 characters).",
          recommendation: "A subject line between 25 and 60 characters achieves optimal open rates on mobile and desktop.",
        });
      } else if (subjectLength > 75) {
        score -= 5;
        issues.push({
          category: "subject",
          severity: "info",
          rule: "SUBJECT_TOO_LONG",
          message: "Subject line exceeds 75 characters and may be truncated on mobile screens.",
          recommendation: "Keep the most compelling keywords within the first 45 characters.",
        });
      }
    }

    // ==========================================
    // 2. SPAM PHRASES & PROMOTIONAL LANGUAGE
    // ==========================================
    let spamTriggerCount = 0;
    const detectedSpamWords: string[] = [];

    for (const phrase of this.HIGH_RISK_SPAM_WORDS) {
      if (lowerSubject.includes(phrase) || lowerHtml.includes(phrase)) {
        spamTriggerCount += 2;
        detectedSpamWords.push(phrase);
      }
    }

    for (const phrase of this.PROMOTIONAL_TRIGGER_WORDS) {
      if (lowerSubject.includes(phrase) || lowerHtml.includes(phrase)) {
        spamTriggerCount += 1;
        detectedSpamWords.push(phrase);
      }
    }

    if (detectedSpamWords.length > 0) {
      const penalty = Math.min(25, detectedSpamWords.length * 5);
      score -= penalty;
      issues.push({
        category: "content",
        severity: detectedSpamWords.length >= 3 ? "warning" : "info",
        rule: "PROMOTIONAL_TRIGGER_WORDS",
        message: `Detected promotional or spam trigger phrases: "${detectedSpamWords.slice(0, 4).join('", "')}".`,
        recommendation:
          "Replace aggressive promotional buzzwords with conversational, value-oriented language to stay in Gmail's Primary inbox.",
      });
    }

    // ==========================================
    // 3. LINK SAFETY & REPUTATION CHECKS
    // ==========================================
    const linkMatches = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const linkCount = linkMatches.length;
    let hasInsecureHttp = false;
    let hasIpAddressLink = false;
    let hasUrlShortener = false;
    let hasDeceptiveAnchor = false;

    for (const match of linkMatches) {
      const href = match[1].trim();
      const anchorText = match[2].replace(/<[^>]+>/g, "").trim();

      // Check unencrypted HTTP
      if (/^http:\/\//i.test(href) && !/^http:\/\/localhost/i.test(href)) {
        hasInsecureHttp = true;
      }

      // Check raw IP address in URL
      if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i.test(href)) {
        hasIpAddressLink = true;
      }

      // Check URL Shorteners
      for (const shortener of this.URL_SHORTENERS) {
        if (href.toLowerCase().includes(shortener)) {
          hasUrlShortener = true;
          break;
        }
      }

      // Deceptive Anchor Check (e.g. text looks like paypal.com but points elsewhere)
      if (/^https?:\/\//i.test(anchorText) || anchorText.includes(".com") || anchorText.includes(".org")) {
        try {
          const anchorDomain = new URL(
            anchorText.startsWith("http") ? anchorText : `https://${anchorText}`
          ).hostname;
          const hrefDomain = new URL(href).hostname;
          if (anchorDomain !== hrefDomain && !hrefDomain.includes("mailpilot")) {
            hasDeceptiveAnchor = true;
          }
        } catch {
          // Ignore invalid URL parse
        }
      }
    }

    if (hasInsecureHttp) {
      score -= 10;
      issues.push({
        category: "links",
        severity: "warning",
        rule: "INSECURE_HTTP_LINKS",
        message: "Email contains unencrypted 'http://' links.",
        recommendation: "Upgrade all links to secure 'https://'. Inbound email filters flag plain HTTP links as insecure.",
      });
    }

    if (hasIpAddressLink) {
      score -= 25;
      issues.push({
        category: "links",
        severity: "critical",
        rule: "IP_ADDRESS_LINK",
        message: "Email contains links pointing directly to IP addresses rather than domain names.",
        recommendation: "Remove raw IP links immediately. This is one of the strongest triggers for Google phishing filters.",
      });
    }

    if (hasUrlShortener) {
      score -= 15;
      issues.push({
        category: "links",
        severity: "warning",
        rule: "URL_SHORTENER_DETECTED",
        message: "Email contains public URL shorteners (e.g. bit.ly, tinyurl).",
        recommendation:
          "Public URL shorteners are heavily penalized by Gmail spam filters when sending from personal accounts. Use direct URLs instead.",
      });
    }

    if (hasDeceptiveAnchor) {
      score -= 30;
      issues.push({
        category: "links",
        severity: "critical",
        rule: "DECEPTIVE_ANCHOR_TEXT",
        message: "Visible link text displays a domain name that does not match the actual destination URL.",
        recommendation: "Make sure visible link text matches the actual link destination, or use descriptive words like 'Visit our website'.",
      });
    }

    // ==========================================
    // 4. STRUCTURE, IMAGES & UNPACKING
    // ==========================================
    const imgMatches = Array.from(html.matchAll(/<img\s+[^>]*>/gi));
    const imageCount = imgMatches.length;

    // Image-only spam check: Many images with almost no text
    if (imageCount >= 1 && wordCount < 30) {
      score -= 15;
      issues.push({
        category: "structure",
        severity: "warning",
        rule: "LOW_TEXT_TO_IMAGE_RATIO",
        message: "Email is mostly images with very little readable text (fewer than 30 words).",
        recommendation:
          "Add at least 2-3 paragraphs of informative text. Spammers often hide text inside images, so image-only emails are heavily scrutinized.",
      });
    }

    // Hidden text check
    if (
      lowerHtml.includes("display:none") ||
      lowerHtml.includes("display: none") ||
      lowerHtml.includes("font-size:0") ||
      lowerHtml.includes("font-size: 0")
    ) {
      // Exclude standard preheader hidden div
      const nonPreheaderHidden = lowerHtml.replace(
        /<div style=["'][^"']*max-height:0px;max-width:0px;opacity:0[^"']*["']>[\s\S]*?<\/div>/gi,
        ""
      );
      if (
        nonPreheaderHidden.includes("display:none") ||
        nonPreheaderHidden.includes("display: none") ||
        nonPreheaderHidden.includes("font-size:0")
      ) {
        score -= 15;
        issues.push({
          category: "structure",
          severity: "warning",
          rule: "HIDDEN_TEXT_DETECTED",
          message: "Detected hidden text styling (e.g. display:none or 0px font size) outside standard preheader snippet.",
          recommendation: "Remove hidden elements. Invisible text used for keyword stuffing is an immediate spam trigger.",
        });
      }
    }

    // Unsubscribe Link presence
    const hasUnsubscribeLink =
      lowerHtml.includes("unsubscribe") ||
      lowerHtml.includes("{{unsubscribe_url}}") ||
      lowerHtml.includes("opt-out") ||
      lowerHtml.includes("optout");

    if (!hasUnsubscribeLink) {
      // Note: MailPilot auto-injects one, but we notify the sender
      issues.push({
        category: "structure",
        severity: "info",
        rule: "AUTO_UNSUBSCRIBE_FOOTER",
        message: "No {{unsubscribe_url}} placeholder found in email body.",
        recommendation: "MailPilot will automatically append a compliant unsubscribe link and RFC 8058 headers to your email.",
      });
    }

    // Personalization check
    const hasPersonalizationTag =
      lowerHtml.includes("{{first_name}}") ||
      lowerSubject.includes("{{first_name}}") ||
      lowerHtml.includes("{{company}}");

    // ==========================================
    // 5. SENDER ALIGNMENT (GMAIL DMARC / SPF)
    // ==========================================
    let isSenderAligned = true;
    if (input.fromEmail && input.authenticatedGmailUser) {
      const fromLower = input.fromEmail.toLowerCase().trim();
      const authLower = input.authenticatedGmailUser.toLowerCase().trim();
      if (fromLower !== authLower) {
        isSenderAligned = false;
        score -= 20;
        issues.push({
          category: "sender",
          severity: "critical",
          rule: "SENDER_ADDRESS_MISMATCH",
          message: `Sender 'From Email' (${fromLower}) does not match authenticated Gmail address (${authLower}).`,
          recommendation:
            "When sending via personal Gmail SMTP, Gmail requires the From header to match your authenticated Gmail address. Sending from a different address causes DMARC SPF failures and direct delivery to spam.",
        });
      }
    }

    // Ensure score is bounded between 0 and 100
    const finalScore = Math.max(0, Math.min(100, score));

    let grade: ContentScanResult["grade"] = "OPTIMAL";
    let summary = "Content follows email deliverability best practices. High probability of reaching Gmail Primary inbox.";

    if (finalScore < 70) {
      grade = "NEEDS_ATTENTION";
      summary = "Critical deliverability risks detected that may cause Gmail to route your message to Spam or reject delivery.";
    } else if (finalScore < 85) {
      grade = "GOOD";
      summary = "Content is generally good, but contains a few promotional indicators that could trigger Gmail's Promotions tab.";
    }

    return {
      score: finalScore,
      grade,
      summary,
      issues,
      metrics: {
        subjectLength,
        wordCount,
        linkCount,
        imageCount,
        spamTriggerCount,
        hasHttpsLinksOnly: !hasInsecureHttp,
        hasUnsubscribeLink,
        hasPersonalizationTag,
        hasPlainTextAlternative: true, // MailPilot generates plain text automatically
        isSenderAligned,
      },
    };
  }

  private static stripHtmlTags(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

