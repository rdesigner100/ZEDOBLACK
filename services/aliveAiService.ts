import { Attachment } from '../types';

const API_BASE_URL = '/api/aliveai';

interface LoginResponse {
  accessToken: string;
}

interface Face {
  id: string;
  mediaIds: string[];
  galleryMedia: boolean;
  name?: string;
}

interface Template {
  id: string;
  name: string;
  imageUrl: string;
}

interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: 'SQUARE' | 'LANDSCAPE' | 'PORTRAIT';
  faceId?: string;
  templateId?: string;
  seed?: string;
}

class AliveAiService {
  private token: string | null = null;
  // Removed email/password properties as they are handled by backend

  constructor() {
    // No need to read env vars here anymore
  }

  private async login(): Promise<string> {
    try {
      // Call our backend proxy login endpoint
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // No body needed, backend has credentials
      });

      if (!response.ok) {
        throw new Error('Failed to login to AliveAI via proxy');
      }

      const data: LoginResponse = await response.json();
      this.token = data.accessToken;
      return this.token;
    } catch (error) {
      console.error('AliveAI Login Error:', error);
      throw error;
    }
  }

  public async getToken(): Promise<string | null> {
    if (!this.token) {
        try {
            await this.login();
        } catch (e) {
            return null;
        }
    }
    return this.token;
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.token) {
      await this.login();
    }

    // Endpoint should be relative to API_BASE_URL, e.g., '/faceswap'
    // If endpoint starts with /, remove it to avoid double slash if base has trailing slash (it doesn't here)
    // But API_BASE_URL is '/api/aliveai', endpoint is '/faceswap'.
    // fetch('/api/aliveai/faceswap') is correct.
    
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      // Token might be expired, try logging in again
      await this.login();
      const newHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      };
      response = await fetch(url, { ...options, headers: newHeaders });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AliveAI API Error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }
// ... (rest of methods remain same)

  async getFaces(): Promise<Face[]> {
    try {
        // Based on doc: https://api-doc.aliveai.app/#tag/Face-Swap-Resource/paths/~1faceswap/get
        return await this.fetchWithAuth('/faceswap');
    } catch (error) {
        console.error("Error fetching faces:", error);
        return [];
    }
  }

  async getTemplates(): Promise<Template[]> {
    try {
        // Based on doc: https://api-doc.aliveai.app/#tag/Template-Resource/paths/~1templates/get
        return await this.fetchWithAuth('/templates');
    } catch (error) {
        console.error("Error fetching templates:", error);
        return [];
    }
  }

  async getPoses(): Promise<any> {
    try {
        // Based on doc: https://api-doc.aliveai.app/#tag/Poses-Resource/paths/~1poses/get
        return await this.fetchWithAuth('/poses');
    } catch (error) {
        console.error("Error fetching poses:", error);
        return {};
    }
  }

  async generateCharacterImage(params: GenerateImageParams & { 
      name?: string; 
      gender?: string; 
      model?: string; 
      pose?: { id: string; type: string; strength?: number };
      faceDetails?: boolean;
      faceMediaIds?: string[];
  }): Promise<string> {
    // Using createPrompt endpoint for full control as requested
    // Doc: https://api-doc.aliveai.app/#tag/Prompts-Resource/operation/createPrompt
    
    const payload: any = {
      name: params.name || "Character", // Required field
      appearance: params.prompt, // "Appearance" is the main prompt
      gender: params.gender || "FEMALE",
      model: params.model || "DEFAULT",
      faceImproveEnabled: params.faceDetails !== false, // Default true
      aspectRatio: params.aspectRatio === 'SQUARE' ? 'DEFAULT' : params.aspectRatio || 'DEFAULT',
    };

    if (params.seed) {
        payload.seed = params.seed;
    }

    // Handle Pose
    if (params.pose) {
        payload.pose = {
            id: params.pose.id,
            type: params.pose.type,
            poseStrength: params.pose.strength || 30 // Default strength mentioned in UI tip
        };
    }

    // Handle Templates (LoRAs)
    if (params.templateId) {
        payload.modelTemplates = [{
            id: params.templateId,
            strength: 10,
            templatePrompt: "" 
        }];
    }

    // Handle Face Swap (Profile) if selected
    if (params.faceMediaIds && params.faceMediaIds.length > 0) {
        payload.faceSwap = {
            mediaIds: params.faceMediaIds,
            faceSwapModel: "DEFAULT",
            isPartialSwap: true,
            swapStrength: 1,
            faceReplaceGender: params.gender || "FEMALE"
        };
    }

    const response = await this.fetchWithAuth('/prompts', { // Endpoint is /prompts for createPrompt
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    // Response sample: { "promptId": "..." } or just 200 OK.
    // Assuming it returns object with promptId or id.
    return response.promptId || response.id;
  }

  async getPromptStatus(promptId: string): Promise<any> {
      // Based on doc: https://api-doc.aliveai.app/#tag/Prompts-Resource/paths/~1prompts~1%7BpromptId%7D/get
      return await this.fetchWithAuth(`/prompts/${promptId}`);
  }
}

export const aliveAiService = new AliveAiService();
