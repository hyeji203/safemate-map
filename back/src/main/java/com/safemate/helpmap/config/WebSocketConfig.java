package com.safemate.helpmap.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * 제보 실시간 브로드캐스팅용 STOMP 엔드포인트 설정.
 * 클라이언트는 SockJS로 /ws-stomp 에 연결하고, /topic/** 을 구독한다.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 서버 -> 클라이언트 브로드캐스트 채널 (예: /topic/reports)
        registry.enableSimpleBroker("/topic");
        // 클라이언트 -> 서버 메시지 prefix
        registry.setApplicationDestinationPrefixes("/app");
    }
}
