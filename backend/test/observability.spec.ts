import { CorrelationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { StructuredLoggerService } from "../src/common/logger/structured-logger.service";
import { Request, Response } from "express";

describe("Observability & Correlation ID", () => {
  describe("CorrelationIdMiddleware", () => {
    let middleware: CorrelationIdMiddleware;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;
    let setHeaderMock: jest.Mock;

    beforeEach(() => {
      middleware = new CorrelationIdMiddleware();
      setHeaderMock = jest.fn();
      mockReq = {
        headers: {},
      };
      mockRes = {
        setHeader: setHeaderMock,
      };
      nextFunction = jest.fn();
    });

    it("should generate a UUID v4 correlation ID when none is provided in headers", () => {
      middleware.use(mockReq as Request, mockRes as Response, nextFunction);

      const generatedId = (mockReq as Request & { id: string }).id;
      expect(generatedId).toBeDefined();
      expect(typeof generatedId).toBe("string");
      expect(generatedId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(setHeaderMock).toHaveBeenCalledWith("X-Request-Id", generatedId);
      expect(mockReq.headers!["x-request-id"]).toBe(generatedId);
      expect(nextFunction).toHaveBeenCalled();
    });

    it("should reuse and propagate incoming X-Request-Id header", () => {
      const existingId = "test-custom-request-id-12345";
      mockReq.headers = { "x-request-id": existingId };

      middleware.use(mockReq as Request, mockRes as Response, nextFunction);

      expect((mockReq as Request & { id: string }).id).toBe(existingId);
      expect(setHeaderMock).toHaveBeenCalledWith("X-Request-Id", existingId);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("StructuredLoggerService", () => {
    let logger: StructuredLoggerService;
    let stdoutSpy: jest.SpyInstance;
    let stderrSpy: jest.SpyInstance;

    beforeEach(() => {
      logger = new StructuredLoggerService("TestContext");
      stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it("should output valid JSON with expected structured fields", () => {
      logger.log("Operational check completed", "SystemStatus");

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const logLine = stdoutSpy.mock.calls[0][0];
      const parsed = JSON.parse(logLine.trim());

      expect(parsed.level).toBe("INFO");
      expect(parsed.context).toBe("SystemStatus");
      expect(parsed.msg).toBe("Operational check completed");
      expect(parsed.time).toBeDefined();
      expect(parsed.app).toBe("hes-api");
    });

    it("should redact sensitive fields such as password, token, and recipientCin", () => {
      const payload = {
        user: "courier@hes.ma",
        password: "SuperSecretPassword123!",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        recipientCin: "BK123456",
        safeField: "Public info",
      };

      logger.log("Dispatching parcel", "Delivery", payload);

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const logLine = stdoutSpy.mock.calls[0][0];
      const parsed = JSON.parse(logLine.trim());

      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.token).toBe("[REDACTED]");
      expect(parsed.recipientCin).toBe("[REDACTED]");
      expect(parsed.safeField).toBe("Public info");
    });

    it("should output errors to stderr with trace", () => {
      logger.error("Connection failure", "Error: Redis timeout", "HealthCheck");

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const logLine = stderrSpy.mock.calls[0][0];
      const parsed = JSON.parse(logLine.trim());

      expect(parsed.level).toBe("ERROR");
      expect(parsed.context).toBe("HealthCheck");
      expect(parsed.msg).toBe("Connection failure");
      expect(parsed.trace).toBe("Error: Redis timeout");
    });
  });
});
