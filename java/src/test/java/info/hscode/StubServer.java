package info.hscode;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** Local HTTP server that answers every request with one canned response and records the requests. */
final class StubServer implements AutoCloseable {
    static final class Recorded {
        final String method;
        final String uri;
        final String authorization;
        final String body;

        Recorded(String method, String uri, String authorization, String body) {
            this.method = method;
            this.uri = uri;
            this.authorization = authorization;
            this.body = body;
        }
    }

    final List<Recorded> requests = Collections.synchronizedList(new ArrayList<>());
    private final HttpServer server;
    private volatile int status = 200;
    private volatile String body = "{}";
    private volatile Map<String, String> headers = Map.of();

    StubServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/", ex -> {
            String reqBody = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            requests.add(new Recorded(
                    ex.getRequestMethod(),
                    ex.getRequestURI().toString(),
                    ex.getRequestHeaders().getFirst("Authorization"),
                    reqBody));
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", "application/json");
            headers.forEach((k, v) -> ex.getResponseHeaders().set(k, v));
            ex.sendResponseHeaders(status, out.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(out);
            }
        });
        server.start();
    }

    StubServer respond(int status, String body) {
        return respond(status, body, Map.of());
    }

    StubServer respond(int status, String body, Map<String, String> headers) {
        this.status = status;
        this.body = body;
        this.headers = headers;
        return this;
    }

    String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    HscodeClient.Builder client() {
        return HscodeClient.builder().baseUrl(url()).apiKey("test-key");
    }

    Recorded last() {
        return requests.get(requests.size() - 1);
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
