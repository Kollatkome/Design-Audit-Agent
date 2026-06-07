export interface BoundingBox {
  x: number;      // 0-100 percentage of width
  y: number;      // 0-100 percentage of height
  width: number;  // 0-100 percentage of width
  height: number; // 0-100 percentage of height
}

export interface RawLayoutElement {
  id: string;
  type: "text" | "button" | "image" | "header" | "input" | "container" | string;
  text?: string;
  fontFamily?: string;
  fontSize?: number; // in px
  foregroundHex?: string;
  backgroundHex?: string;
  box: BoundingBox;
}

export interface DetectionResult {
  id: string;
  category: "Visual Hierarchy" | "Contrast (WCAG AA)" | "Spacing" | "Alignment" | "Consistency" | "Typography" | "Accessibility" | string;
  severity: "critical" | "high" | "medium" | "low";
  location: string;
  coordinates: BoundingBox;
  evidence: string;
  recommendation: string;
  confidenceScore: number;
}

export interface IDetector {
  analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]>;
  validate(result: DetectionResult): boolean;
  generateEvidence(result: DetectionResult): string;
  confidence(): number;
}

// Deterministic WCAG Relative Luminance and Contrast Ratio calculation
export function calculateRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return 0;
  
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = calculateRelativeLuminance(foregroundHex);
  const l2 = calculateRelativeLuminance(backgroundHex);

  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);

  return (brightest + 0.05) / (darkest + 0.05);
}

// 1. ContrastDetector Class
export class ContrastDetector implements IDetector {
  async analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    
    for (const el of elements) {
      if (el.foregroundHex && el.backgroundHex) {
        const ratio = calculateContrastRatio(el.foregroundHex, el.backgroundHex);
        const isLargeText = (el.fontSize && el.fontSize >= 18) || false;
        const requiredRatio = isLargeText ? 3.0 : 4.5;
        
        if (ratio < requiredRatio) {
          const result: DetectionResult = {
            id: `contrast-${el.id}`,
            category: "Contrast (WCAG AA)",
            severity: ratio < 2.5 ? "critical" : "high",
            location: el.text ? `Text: "${el.text}"` : `Element type "${el.type}"`,
            coordinates: el.box,
            evidence: `Foreground ${el.foregroundHex} on background ${el.backgroundHex} yields contrast ratio ${ratio.toFixed(2)}:1. Required ratio: ${requiredRatio}:1.`,
            recommendation: `Increase color contrast. Use a darker foreground hex like #111827 or a lighter background.`,
            confidenceScore: this.confidence()
          };
          
          if (this.validate(result)) {
            results.push(result);
          }
        }
      }
    }
    
    return results;
  }

  validate(result: DetectionResult): boolean {
    return result.evidence.includes("contrast ratio");
  }

  generateEvidence(result: DetectionResult): string {
    return result.evidence;
  }

  confidence(): number {
    return 98;
  }
}

// 2. AlignmentDetector Class
export class AlignmentDetector implements IDetector {
  async analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    const groups: { [key: number]: RawLayoutElement[] } = {};
    const tolerance = 1.5;

    for (const el of elements) {
      if (el.type === "container") continue;
      
      let foundGroup = false;
      const x = el.box.x;
      
      for (const groupKeyStr of Object.keys(groups)) {
        const groupKey = parseFloat(groupKeyStr);
        if (Math.abs(x - groupKey) <= tolerance) {
          groups[groupKey].push(el);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groups[x] = [el];
      }
    }

    for (const groupKeyStr of Object.keys(groups)) {
      const groupElements = groups[parseFloat(groupKeyStr)];
      if (groupElements.length > 1) {
        const baseIp = groupElements[0];
        for (let i = 1; i < groupElements.length; i++) {
          const current = groupElements[i];
          const diff = Math.abs(current.box.x - baseIp.box.x);
          
          if (diff > 0.3 && diff <= tolerance) {
            const result: DetectionResult = {
              id: `align-${current.id}`,
              category: "Alignment",
              severity: "medium",
              location: current.text ? `Element: "${current.text}"` : `UI Component (type: ${current.type})`,
              coordinates: current.box,
              evidence: `Offset misalignment of ${diff.toFixed(2)}% detected relative to align-axis established by "${baseIp.text || baseIp.type}".`,
              recommendation: `Align element horizontally. Enforce grid or flex layout options (e.g. pl-0 or align-items: start).`,
              confidenceScore: this.confidence()
            };
            results.push(result);
          }
        }
      }
    }

    return results;
  }

  validate(result: DetectionResult): boolean {
    return result.coordinates.x !== undefined;
  }

  generateEvidence(result: DetectionResult): string {
    return result.evidence;
  }

  confidence(): number {
    return 90;
  }
}

// 3. SpacingDetector Class
export class SpacingDetector implements IDetector {
  async analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    const sorted = [...elements]
      .filter(el => el.type !== "container")
      .sort((a, b) => a.box.y - b.box.y);

    for (let i = 0; i < sorted.length - 2; i++) {
      const first = sorted[i];
      const second = sorted[i + 1];
      const third = sorted[i + 2];

      const gap1 = second.box.y - (first.box.y + first.box.height);
      const gap2 = third.box.y - (second.box.y + second.box.height);

      if (gap1 > 0 && gap2 > 0 && Math.abs(gap1 - gap2) > 0.8 && Math.abs(gap1 - gap2) < 4.0) {
        const result: DetectionResult = {
          id: `spacing-${second.id}`,
          category: "Spacing",
          severity: "low",
          location: `Grid gaps between "${first.text || first.type}", "${second.text || second.type}", and "${third.text || third.type}"`,
          coordinates: second.box,
          evidence: `Uneven layout margins detected. Margin A: ${gap1.toFixed(1)}% vs Margin B: ${gap2.toFixed(1)}% of container height.`,
          recommendation: `Standardize spacing to a baseline multiplier (e.g., margins matching 8px / 16px grid patterns).`,
          confidenceScore: this.confidence()
        };
        results.push(result);
      }
    }

    return results;
  }

  validate(result: DetectionResult): boolean {
    return result.evidence.includes("Uneven");
  }

  generateEvidence(result: DetectionResult): string {
    return result.evidence;
  }

  confidence(): number {
    return 85;
  }
}

// 4. TypographyDetector Class
export class TypographyDetector implements IDetector {
  async analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    for (const el of elements) {
      if (el.type === "text" && el.fontSize) {
        if (el.fontSize < 12) {
          const result: DetectionResult = {
            id: `type-size-${el.id}`,
            category: "Typography",
            severity: "high",
            location: `Text element: "${el.text || 'Label'}"`,
            coordinates: el.box,
            evidence: `Text font size is ${el.fontSize}px, which violates minimal sizing rules for visual reading comfort.`,
            recommendation: `Increase font size to at least 12px (preferably 14px for default body elements).`,
            confidenceScore: this.confidence()
          };
          results.push(result);
        }
      }
    }

    return results;
  }

  validate(result: DetectionResult): boolean {
    return result.coordinates.height > 0;
  }

  generateEvidence(result: DetectionResult): string {
    return result.evidence;
  }

  confidence(): number {
    return 95;
  }
}

// 5. HierarchyDetector Class
export class HierarchyDetector implements IDetector {
  async analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    const headers = elements.filter(el => el.type === "header");
    const texts = elements.filter(el => el.type === "text");

    for (const header of headers) {
      for (const text of texts) {
        if (header.fontSize && text.fontSize && text.fontSize >= header.fontSize) {
          const result: DetectionResult = {
            id: `hierarchy-${header.id}`,
            category: "Visual Hierarchy",
            severity: "medium",
            location: `Header element "${header.text || 'Title'}" compared to text body "${text.text || 'Paragraph'}"`,
            coordinates: header.box,
            evidence: `Body text font size (${text.fontSize}px) is equal or larger than header size (${header.fontSize}px).`,
            recommendation: `Increase visual contrast weighting. Boost header font-size or font-weight to create clear visual layers.`,
            confidenceScore: this.confidence()
          };
          results.push(result);
        }
      }
    }

    return results;
  }

  validate(result: DetectionResult): boolean {
    return result.evidence.includes("visual");
  }

  generateEvidence(result: DetectionResult): string {
    return result.evidence;
  }

  confidence(): number {
    return 80;
  }
}

// 6. AccessibilityDetector Class
export class AccessibilityDetector implements IDetector {
  async analyze(elements: RawLayoutElement[]): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    for (const el of elements) {
      if (el.type === "button" && el.box.height < 5) {
        const result: DetectionResult = {
          id: `access-target-${el.id}`,
          category: "Accessibility",
          severity: "high",
          location: `Button target area: "${el.text || 'Action'}"`,
          coordinates: el.box,
          evidence: `Button vertical size is only ${el.box.height}% of screen layout height, which may fail touch-target guidelines (<44px target sizes).`,
          recommendation: `Increase tap padding/dimensions to guarantee responsive targets on all viewport screens.`,
          confidenceScore: this.confidence()
        };
        results.push(result);
      }
    }

    return results;
  }

  validate(result: DetectionResult): boolean {
    return result.coordinates.width > 0;
  }

  generateEvidence(result: DetectionResult): string {
    return result.evidence;
  }

  confidence(): number {
    return 90;
  }
}

// Confidence Engine
export function deriveConfidence(ocrClarity: number, evidenceCertainty: number, detectorAgreement: number): number {
  const confidence = (0.4 * ocrClarity) + (0.3 * evidenceCertainty) + (0.3 * detectorAgreement);
  return Math.round(Math.min(100, Math.max(0, confidence)));
}
