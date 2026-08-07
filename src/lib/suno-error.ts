/**
 * Helper parse lỗi Suno cho Client Components (an toàn 100%, không dính Node.js native modules)
 */
export function parseSunoError(rawMsg: string): { title: string; message: string } {
  if (!rawMsg) {
    return { title: 'Tạo nhạc thất bại', message: 'Hệ thống không thể phản hồi lúc này.' };
  }

  let text = String(rawMsg);
  let statusCode: number | null = null;
  let jsonDetail: any = null;

  // Extract status code if present (e.g. Status: 402)
  const statusMatch = text.match(/\(Status:\s*(\d+)\)/i);
  if (statusMatch) {
    statusCode = parseInt(statusMatch[1], 10);
  }

  // Attempt to parse JSON embedded inside the rawMsg
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      jsonDetail = JSON.parse(jsonMatch[0]);
    } catch { }
  }

  const errorType = jsonDetail?.error_type || '';
  const detailStr = typeof jsonDetail?.detail === 'string' ? jsonDetail.detail : '';

  // 1. Backend / Server provider busy (Status 402 / insufficient_credits internal)
  if (
    statusCode === 402 ||
    errorType === 'insufficient_credits' ||
    detailStr.includes('enough credits') ||
    text.includes('insufficient_credits') ||
    text.includes('enough credits')
  ) {
    return {
      title: 'Tạo nhạc thất bại',
      message: 'Hệ thống khởi tạo nhạc hiện đang bận. Vui lòng thử lại sau ít phút.'
    };
  }

  // 2. Session / Connection timeout (Status 401 / 422 / Token Validation / Browser Token)
  if (
    statusCode === 401 ||
    statusCode === 422 ||
    errorType === 'unauthorized' ||
    errorType === 'token_validation_failed' ||
    detailStr.includes('unauthorized') ||
    text.includes('token_validation_failed') ||
    text.includes('Browser Token') ||
    text.includes('Unauthorized') ||
    text.includes('Cookie hết hạn') ||
    text.includes('We couldn\'t verify your request')
  ) {
    return {
      title: 'Tạo nhạc thất bại',
      message: 'Hệ thống hiện đang bận xử lý. Vui lòng thử lại sau ít phút.'
    };
  }

  // 3. Rate limit / Too many requests (Status 429)
  if (
    statusCode === 429 ||
    errorType === 'rate_limit' ||
    detailStr.includes('rate limit') ||
    text.includes('rate limit') ||
    text.includes('Suno đang giới hạn request')
  ) {
    return {
      title: 'Hệ thống bận',
      message: 'Hệ thống đang tiếp nhận quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'
    };
  }

  // 4. Copyright violation
  if (text.includes('trùng khớp với bản nhạc có bản quyền') || text.includes('copyright') || text.includes('bản quyền')) {
    return {
      title: 'Từ chối bản quyền',
      message: 'Giai điệu hoặc ca từ bị từ chối do trùng khớp bản quyền âm nhạc.'
    };
  }

  // 5. Audio file too short
  if (text.includes('quá ngắn') || text.includes('too short')) {
    return {
      title: 'Tệp quá ngắn',
      message: 'Tệp âm thanh tải lên quá ngắn để phân tích tạo nhạc.'
    };
  }

  // 6. Invalid model for account level
  if (text.includes("The selected model isn't valid") || text.includes('invalid_input')) {
    return {
      title: 'Model không hỗ trợ',
      message: 'Tài khoản của bạn không thể sử dụng mô hình này. Vui lòng chọn v3.5 hoặc v4.'
    };
  }

  // Clean up any remaining Suno / Cookie / Technical instructions in text
  let cleaned = text
    .replace(/^Lỗi sinh nhạc qua Suno\.com Cookie \(Status: \d+\):\s*/i, '')
    .replace(/^Lỗi xử lý file âm thanh:\s*/i, '')
    .replace(/suno(\.com)?/gi, 'hệ thống')
    .replace(/cookie/gi, 'kết nối')
    .replace(/\{[\s\S]*\}/g, '')
    .trim();

  if (!cleaned || cleaned.length < 3 || cleaned.includes('Browser Token') || cleaned.includes('studio-api') || cleaned.length > 80) {
    cleaned = 'Hệ thống hiện đang bận xử lý. Vui lòng thử lại sau ít phút.';
  }

  return {
    title: 'Tạo nhạc thất bại',
    message: cleaned
  };
}
