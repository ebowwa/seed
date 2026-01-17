# ============================================================================
# Node Agent Installation - to be added to setup.sh
# ============================================================================

# Install Node Agent - Ralph Loop Orchestration API Server
# Provides HTTP API for managing git worktrees and autonomous Ralph loops
# Runs as systemd service for persistent operation
install_node_agent() {
    # Only install on VPS nodes (not needed for local/codespaces)
    if [[ "$DETECTED_ENV" != "vps" ]]; then
        print_info "Skipping Node Agent installation (only needed on VPS nodes)"
        return 0
    fi

    print_info "Installing Node Agent..."

    local node_agent_dir="${SCRIPT_DIR}/node-agent"
    local systemd_dir="/etc/systemd/system"

    # Check if Node Agent directory exists
    if [[ ! -d "$node_agent_dir" ]]; then
        print_error "Node Agent directory not found at $node_agent_dir"
        print_info "Expected structure: seed/node-agent/"
        return 1
    fi

    # Create .env file if it doesn't exist
    if [[ ! -f "$node_agent_dir/.env" ]]; then
        if [[ -f "$node_agent_dir/.env.example" ]]; then
            cp "$node_agent_dir/.env.example" "$node_agent_dir/.env"
            print_success "Created .env from .env.example"
        fi
    fi

    # Install dependencies
    print_info "Installing Node Agent dependencies..."
    cd "$node_agent_dir"
    if command -v bun &> /dev/null; then
        bun install 2>/dev/null || true
    fi

    # Create systemd service
    print_info "Creating systemd service..."
    local service_file="${node_agent_dir}/systemd/node-agent.service"

    if [[ -f "$service_file" ]]; then
        # Copy service file to systemd directory
        sudo cp "$service_file" "${systemd_dir}/node-agent.service"

        # Get current username (handle both root and non-root)
        local service_user="${SUDO_USER:-$USER}"
        if [[ "$service_user" == "root" ]]; then
            service_user="ubuntu"
        fi

        # Update service file with correct user
        sudo sed -i "s|User=ubuntu|User=$service_user|g" "${systemd_dir}/node-agent.service"
        sudo sed -i "s|Group=ubuntu|Group=$service_user|g" "${systemd_dir}/node-agent.service"
        sudo sed -i "s|/home/ubuntu/|/home/$service_user/|g" "${systemd_dir}/node-agent.service"

        # Create required directories
        local base_path="/home/$service_user"
        sudo mkdir -p "$base_path/repos"
        sudo mkdir -p "$base_path/.node-agent/pids"
        sudo mkdir -p "$base_path/.node-agent/logs"

        # Set ownership
        sudo chown -R "$service_user:$service_user" "$base_path/repos"
        sudo chown -R "$service_user:$service_user" "$base_path/.node-agent"

        # Reload systemd and enable service
        sudo systemctl daemon-reload
        sudo systemctl enable node-agent.service

        # Start the service
        print_info "Starting Node Agent service..."
        sudo systemctl start node-agent.service

        # Wait a moment for service to start
        sleep 3

        # Check if service is running
        if systemctl is-active --quiet node-agent.service; then
            print_success "Node Agent installed and running on port 8911"
            print_info "API available at: http://localhost:8911/api/status"
        else
            print_error "Failed to start Node Agent service"
            print_info "Check logs with: journalctl -u node-agent -f"
            return 1
        fi
    else
        print_error "systemd service file not found at $service_file"
        return 1
    fi

    return 0
}
