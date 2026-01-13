/**
 * JD Agent - Screenshot Analyzer
 *
 * Uses multi-provider LLM vision capabilities to analyze screenshots
 * and understand the current UI state.
 *
 * Supports: OpenAI GPT-4o, Anthropic Claude, Google Gemini, Ollama (llava)
 */

import { VisionProvider, type VisionProviderConfig, type ImageContent } from './vision-provider';
import type { AnalysisResult } from './types';

export class ScreenshotAnalyzer {
  private visionProvider: VisionProvider;

  constructor(config?: VisionProviderConfig) {
    this.visionProvider = new VisionProvider(config);
    if (!this.visionProvider.isAvailable()) {
      throw new Error(
        'No vision provider available for ScreenshotAnalyzer. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OLLAMA_HOST'
      );
    }
    console.log(`[ScreenshotAnalyzer] Using provider: ${this.visionProvider.getProviderName()}`);
  }

  /**
   * Analyze a screenshot with a specific question
   */
  async analyze(base64Image: string, question: string): Promise<AnalysisResult> {
    const images: ImageContent[] = [{ base64: base64Image }];
    const result = await this.visionProvider.analyzeImage(images, question);

    if (result.success) {
      return {
        success: true,
        data: { analysis: result.analysis || '' },
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  }

  /**
   * Detect and describe UI elements visible in the screenshot
   */
  async detectElements(base64Image: string): Promise<AnalysisResult> {
    const question = `Analyze this screenshot and identify the key UI elements. Return a structured analysis:

1. **Buttons**: List all visible buttons with their labels
2. **Inputs**: List all visible input fields (text fields, dropdowns, etc.)
3. **Links**: List all visible navigation links
4. **Headings**: List the main headings/titles visible
5. **Errors**: Note any error messages, warnings, or red text
6. **Loading States**: Note any spinners, skeleton loaders, or loading indicators
7. **Current Page**: What page/section does this appear to be?

Be specific and exhaustive in your analysis.`;

    const images: ImageContent[] = [{ base64: base64Image }];
    const result = await this.visionProvider.analyzeImage(images, question);

    if (result.success) {
      const analysis = result.analysis || '';
      const elements = this.parseElementsFromAnalysis(analysis);

      return {
        success: true,
        data: { analysis, elements },
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  }

  /**
   * Check if the page appears to have any errors
   */
  async checkForErrors(base64Image: string): Promise<{
    hasErrors: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const question = `Look at this screenshot and identify ANY of the following:
1. Error messages (red text, error boxes, error toasts)
2. Warning messages (yellow/orange alerts)
3. Empty states that might indicate missing data
4. Broken images or missing content
5. Loading states that might indicate slow loading
6. Console-style error text

For each issue found, describe it briefly. If there are no issues, say "No errors or warnings detected."

Return in this format:
ERRORS: [list each error, or "none"]
WARNINGS: [list each warning, or "none"]`;

    const images: ImageContent[] = [{ base64: base64Image }];
    const result = await this.visionProvider.analyzeImage(images, question);

    if (!result.success) {
      return {
        hasErrors: false,
        errors: [],
        warnings: [`Analysis failed: ${result.error}`],
      };
    }

    const analysis = result.analysis || '';

    // Parse errors and warnings from the response
    const errors: string[] = [];
    const warnings: string[] = [];

    const errorMatch = analysis.match(/ERRORS?:\s*([^\n]+(?:\n(?!WARNINGS?:)[^\n]+)*)/i);
    const warningMatch = analysis.match(/WARNINGS?:\s*([^\n]+(?:\n(?!ERRORS?:)[^\n]+)*)/i);

    if (errorMatch && !errorMatch[1].toLowerCase().includes('none')) {
      errors.push(...this.parseListItems(errorMatch[1]));
    }

    if (warningMatch && !warningMatch[1].toLowerCase().includes('none')) {
      warnings.push(...this.parseListItems(warningMatch[1]));
    }

    return {
      hasErrors: errors.length > 0,
      errors,
      warnings,
    };
  }

  /**
   * Compare two screenshots to detect changes
   */
  async compareScreenshots(
    before: string,
    after: string,
    action: string
  ): Promise<{
    changed: boolean;
    description: string;
  }> {
    const question = `I performed this action: "${action}"

The first image is BEFORE and the second image is AFTER. Compare them and describe:
1. What changed visually between the two screenshots?
2. Did the action appear to have the expected effect?
3. Are there any unexpected changes or issues?

Be specific about what elements changed.`;

    const images: ImageContent[] = [
      { base64: before },
      { base64: after },
    ];
    const result = await this.visionProvider.analyzeImage(images, question);

    if (!result.success) {
      return {
        changed: false,
        description: `Comparison failed: ${result.error}`,
      };
    }

    const description = result.analysis || '';

    // Determine if there were changes (if the description mentions "same" or "no change", likely no changes)
    const changed = !description.toLowerCase().includes('no change') &&
                   !description.toLowerCase().includes('identical') &&
                   !description.toLowerCase().includes('same as before');

    return {
      changed,
      description,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private parseElementsFromAnalysis(analysis: string): {
    buttons: string[];
    inputs: string[];
    links: string[];
    headings: string[];
    errors: string[];
  } {
    const elements = {
      buttons: [] as string[],
      inputs: [] as string[],
      links: [] as string[],
      headings: [] as string[],
      errors: [] as string[],
    };

    // Simple parsing - look for sections
    const buttonMatch = analysis.match(/buttons?:?\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i);
    const inputMatch = analysis.match(/inputs?:?\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i);
    const linkMatch = analysis.match(/links?:?\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i);
    const headingMatch = analysis.match(/headings?:?\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i);
    const errorMatch = analysis.match(/errors?:?\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i);

    if (buttonMatch) elements.buttons = this.parseListItems(buttonMatch[1]);
    if (inputMatch) elements.inputs = this.parseListItems(inputMatch[1]);
    if (linkMatch) elements.links = this.parseListItems(linkMatch[1]);
    if (headingMatch) elements.headings = this.parseListItems(headingMatch[1]);
    if (errorMatch) elements.errors = this.parseListItems(errorMatch[1]);

    return elements;
  }

  private parseListItems(text: string): string[] {
    const items: string[] = [];

    // Split by common list separators
    const lines = text.split(/[,\n]/).map((s) => s.trim());

    for (const line of lines) {
      // Remove list markers like "- ", "* ", "1. ", etc.
      const cleaned = line.replace(/^[-*•]\s*|\d+\.\s*/, '').trim();
      if (cleaned && cleaned.length > 0 && !cleaned.toLowerCase().includes('none')) {
        items.push(cleaned);
      }
    }

    return items;
  }
}
