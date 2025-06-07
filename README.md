# Card Game PDF Transformer

A modern web application for transforming PDF files into print-and-play card game formats. This tool helps board game designers and enthusiasts extract individual cards from PDF files and reorganize them for optimal printing.

## Features

- **Multi-format PDF Support**: Handle both simplex and duplex PDF files
- **Intelligent Card Extraction**: Automatically detect and extract individual cards from PDF pages
- **Flexible Layout Configuration**: Customize output layouts for different card sizes and printer capabilities
- **Real-time Preview**: See your changes before exporting
- **Settings Management**: Save and load configuration presets
- **Modern Interface**: Built with React and Tailwind CSS for a smooth user experience

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/card-game-pdf-transformer.git
   cd card-game-pdf-transformer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Import PDF**: Upload your PDF file and configure the page settings
2. **Extract Cards**: Set up the grid layout and cropping parameters
3. **Configure Layout**: Adjust the output format and card arrangements
4. **Export**: Download your processed PDF ready for printing

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **PDF Processing**: PDF.js
- **Icons**: Lucide React

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Magic Patterns](https://magicpatterns.com) design system
- PDF processing powered by [PDF.js](https://mozilla.github.io/pdf.js/)
